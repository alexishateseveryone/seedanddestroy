// Serverless multiplayer over WebRTC (PeerJS). No game server to run, nobody has to open ports.
//
// The host's browser IS the room. Guests connect straight to the host (star topology) and the host forwards
// guest <-> guest messages, so 5v5.js keeps working unchanged:
//
//   const net=createNet();
//   const code=await net.host();                 // host: returns the room code to share, e.g. "K7QM2"   (my id = 1)
//   const info=await net.join('K7QM2');          // guest: {id, host:1, peers:[ids already in the room]}
//   net.rel(d);  net.rel(d,toId);                // send game data to everybody else / to one player
//   net.onPeer=(fromId,d)=>{}                    // game data arrived
//   net.onSrv=m=>{}                              // room events: {t:'peer+',id} {t:'peer-',id} {t:'closed'} (host left)
//   net.lock(true)                               // host: refuse new guests (match started)
//   net.close()
//
// PeerJS's free cloud broker is only used for the first handshake (finding the host by its code);
// all game traffic then flows directly player <-> player.
const Peer=window.Peer;   // loaded by a <script> tag in index.html (node_modules/peerjs/dist/peerjs.min.js)
if(!Peer)console.error('PeerJS is missing: run npm install, and check node_modules/peerjs/dist/peerjs.min.js exists');

const MAX=10,PREFIX='sad-',ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I: easy to read out loud
const mkCode=()=>Array.from({length:5},()=>ALPHA[(Math.random()*ALPHA.length)|0]).join('');
const OPTS={reliable:true,serialization:'json'};

export const cleanCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);

export function createNet(){
  let peer=null,hostConn=null,locked=false,nextId=1;
  const conns=new Map();                                   // host only: guest id -> DataConnection
  const n={id:0,code:'',isHost:false,onSrv:null,onPeer:null,
    get open(){return n.isHost?!!peer:!!hostConn&&hostConn.open},

    /** create a room; resolves with its 5-letter code */
    host(){
      n.close();n.isHost=true;n.id=1;nextId=1;locked=false;
      return new Promise((res,rej)=>{
        let tries=0;
        const attempt=()=>{
          const code=mkCode(),p=new Peer(PREFIX+code);peer=p;
          p.on('open',()=>{n.code=code;res(code)});
          p.on('connection',onGuest);
          p.on('error',e=>{
            if(e.type==='unavailable-id'&&tries++<6){try{p.destroy()}catch(_){}return attempt()}   // code already taken: roll another
            if(!n.code){n.close();rej(new Error(e.type==='network'||e.type==='server-error'||e.type==='socket-error'?'Cannot reach the matchmaking service (internet needed to create a room)':'Could not create the room'))}
          });
          p.on('disconnected',()=>{try{p.reconnect()}catch(_){}});      // lost the broker only: existing player links stay alive
        };
        attempt();
      });
    },

    /** join a room by code; resolves with {id,host,peers} */
    join(code){
      n.close();n.isHost=false;code=cleanCode(code);
      return new Promise((res,rej)=>{
        if(code.length!==5)return rej(new Error('The code has 5 letters / numbers'));
        let done=false;const fail=m=>{if(done)return;done=true;clearTimeout(to);n.close();rej(new Error(m))};
        const to=setTimeout(()=>fail('Room not found or unreachable'),15000);
        const p=new Peer();peer=p;
        p.on('error',e=>fail(e.type==='peer-unavailable'?'Room not found':e.type==='network'||e.type==='server-error'||e.type==='socket-error'?'Cannot reach the matchmaking service (internet needed to join)':'Could not connect'));
        p.on('open',()=>{
          const c=p.connect(PREFIX+code,OPTS);hostConn=c;
          c.on('data',m=>{
            if(!m)return;
            if(m.c==='hello'){if(done)return;done=true;clearTimeout(to);n.id=m.id;n.code=code;watch(c);res({id:m.id,host:m.host,peers:m.peers});return}
            if(m.c==='full'){fail(m.msg||'Room is not available');return}
            if(m.c==='r'){n.onPeer&&n.onPeer(m.from,m.d);return}
            if(m.c==='peer+'||m.c==='peer-'){n.onSrv&&n.onSrv({t:m.c,id:m.id});return}
          });
          c.on('close',()=>{if(!done)return fail('Room closed');if(hostConn!==c)return;hostConn=null;n.onSrv&&n.onSrv({t:'closed'})});   // (hostConn is cleared first by close(), so leaving on purpose is silent)
          c.on('error',()=>{});
        });
      });
    },

    /** host only: true = nobody else can join (the match has started) */
    lock(v){locked=!!v},

    /** game data to everybody else in the room (or to one player id) */
    rel(d,to){
      if(n.isHost){
        if(to!=null){const c=conns.get(to);c&&c.open&&c.send({c:'r',from:1,d});return}
        for(const c of conns.values())c.open&&c.send({c:'r',from:1,d});
      }else if(hostConn&&hostConn.open)hostConn.send(to==null?{c:'r',d}:{c:'r',d,to});
    },

    close(){
      const all=[...conns.values()];conns.clear();
      for(const c of all)try{c.close()}catch(_){}
      const hc=hostConn;hostConn=null;try{hc&&hc.close()}catch(_){}
      try{peer&&peer.destroy()}catch(_){}
      peer=null;n.id=0;n.code='';n.isHost=false;locked=false;
    }
  };

  // ---- host side ----------------------------------------------------------------------------------------------
  function onGuest(c){
    c.on('open',()=>{
      if(locked||conns.size+1>=MAX){c.send({c:'full',msg:locked?'The match already started':'Room is full'});setTimeout(()=>{try{c.close()}catch(_){}},300);return}
      const id=++nextId,others=[1,...conns.keys()];
      c.gid=id;conns.set(id,c);watch(c);
      c.send({c:'hello',id,host:1,peers:others});
      for(const o of conns.values())if(o!==c&&o.open)o.send({c:'peer+',id});
      n.onSrv&&n.onSrv({t:'peer+',id});
    });
    c.on('data',m=>{
      if(!m||m.c!=='r'||!c.gid)return;
      const from=c.gid;
      if(m.to==null||m.to===1)n.onPeer&&n.onPeer(from,m.d);                 // for me
      if(m.to==null){for(const o of conns.values())if(o!==c&&o.open)o.send({c:'r',from,d:m.d})}   // relay to the other guests
      else if(m.to!==1){const o=conns.get(m.to);o&&o.open&&o.send({c:'r',from,d:m.d})}
    });
    const gone=()=>{
      if(!c.gid||conns.get(c.gid)!==c)return;
      conns.delete(c.gid);
      for(const o of conns.values())o.open&&o.send({c:'peer-',id:c.gid});
      n.onSrv&&n.onSrv({t:'peer-',id:c.gid});
    };
    c.on('close',gone);c.on('error',gone);
  }

  // a vanished player (power cut, Wi-Fi gone) never sends a clean "close": drop links that stay broken for 6 s
  function watch(c){
    const pc=c.peerConnection;if(!pc)return;let t=0;
    pc.addEventListener('iceconnectionstatechange',()=>{
      const s=pc.iceConnectionState;clearTimeout(t);
      if(s==='failed'||s==='closed')try{c.close()}catch(_){}
      else if(s==='disconnected')t=setTimeout(()=>{try{c.close()}catch(_){}},6000);
    });
  }
  return n;
}
