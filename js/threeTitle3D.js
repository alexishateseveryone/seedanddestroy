import * as T from 'three';

export function createThreeDTitle() {
  const group = new T.Group();
  group.name = 'ThreeDTitle';

  // Game color materials
  const seedMat = new T.MeshStandardMaterial({ color: '#22c55e', roughness: 0.4, metalness: 0.1 });
  const woodMat = new T.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 });
  const redMat = new T.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3, emissive: '#991b1b', emissiveIntensity: 0.2 });
  const leafMat = new T.MeshStandardMaterial({ color: '#15803d', roughness: 0.5 });
  const panelMat = new T.MeshStandardMaterial({ color: '#2b2150', roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.85 });

  const titleRoot = new T.Group();

  // Dark background backing panel
  const panel = new T.Mesh(new T.BoxGeometry(5.8, 2.8, 0.3), panelMat);
  panel.position.set(0, 0.4, -0.15);
  titleRoot.add(panel);

  // SEED (Left)
  const seedGroup = createChunkyText("SEED", seedMat);
  seedGroup.position.set(-2.4, 1.1, 0.1);
  seedGroup.scale.set(0.55, 0.55, 0.55);
  titleRoot.add(seedGroup);

  // Twisted Branch Ampersand (&) in Center
  const branchGroup = new T.Group();
  const branchGeo = new T.CylinderGeometry(0.07, 0.11, 1.6, 8);
  const b1 = new T.Mesh(branchGeo, woodMat); b1.rotation.z = 0.4;
  const b2 = new T.Mesh(branchGeo, woodMat); b2.rotation.z = -0.4; b2.position.set(0.1, 0, 0.05);
  branchGroup.add(b1, b2);
  
  const leafGeo = new T.ConeGeometry(0.18, 0.45, 5);
  const leaf1 = new T.Mesh(leafGeo, leafMat); leaf1.rotation.z = -1.2; leaf1.position.set(-0.25, 0.6, 0.1);
  const leaf2 = new T.Mesh(leafGeo, leafMat); leaf2.rotation.z = 1.0; leaf2.position.set(0.25, -0.4, 0.1);
  branchGroup.add(leaf1, leaf2);
  branchGroup.position.set(-0.05, 1.0, 0.2);
  titleRoot.add(branchGroup);

  // DESTROY (Right)
  const destroyGroup = createChunkyText("DESTROY", seedMat);
  destroyGroup.position.set(0.35, 1.1, 0.1);
  destroyGroup.scale.set(0.4, 0.4, 0.4);
  titleRoot.add(destroyGroup);

  // NO MERCY! (Bottom Row)
  const mercyGroup = createChunkyText("NO MERCY!", redMat);
  mercyGroup.position.set(-2.2, -0.25, 0.1);
  mercyGroup.scale.set(0.58, 0.58, 0.58);
  titleRoot.add(mercyGroup);

  // Procedural Blood Drips
  for (let i = 0; i < 4; i++) {
    const drip = new T.Mesh(new T.ConeGeometry(0.05, 0.28, 6), redMat);
    drip.rotation.x = Math.PI;
    drip.position.set(-1.6 + i * 1.05, -0.62, 0.15);
    titleRoot.add(drip);
  }

  group.add(titleRoot);
  return group;
}

// Procedural 3D Letter Mesh Builder using primitive boxes and cylinders
function createChunkyText(text, material) {
  const g = new T.Group();
  const letters = text.split('');
  
  letters.forEach((char, i) => {
    const letterGroup = new T.Group();
    letterGroup.position.set(i * 0.52, 0, 0);
    
    if (char === 'S') {
      letterGroup.add(
        mkBox(0.32, 0.14, 0.25, 0, 0.32, 0, material),
        mkBox(0.16, 0.24, 0.25, -0.09, 0.15, 0, material),
        mkBox(0.32, 0.14, 0.25, 0, 0, 0, material),
        mkBox(0.16, 0.24, 0.25, 0.09, -0.15, 0, material),
        mkBox(0.32, 0.14, 0.25, 0, -0.32, 0, material)
      );
    } else if (char === 'E') {
      letterGroup.add(
        mkBox(0.12, 0.76, 0.25, -0.11, 0, 0, material),
        mkBox(0.28, 0.12, 0.25, 0.05, 0.32, 0, material),
        mkBox(0.22, 0.12, 0.25, 0.02, 0, 0, material),
        mkBox(0.28, 0.12, 0.25, 0.05, -0.32, 0, material)
      );
    } else if (char === 'D') {
      letterGroup.add(
        mkBox(0.12, 0.76, 0.25, -0.11, 0, 0, material),
        mkBox(0.26, 0.76, 0.25, 0.07, 0, 0, material)
      );
    } else if (char === 'T') {
      letterGroup.add(
        mkBox(0.38, 0.12, 0.25, 0, 0.32, 0, material),
        mkBox(0.12, 0.64, 0.25, 0, -0.06, 0, material)
      );
    } else if (char === 'R') {
      const leg = mkBox(0.12, 0.42, 0.25, 0.08, -0.19, 0, material);
      leg.rotation.z = -0.4;
      letterGroup.add(
        mkBox(0.12, 0.76, 0.25, -0.11, 0, 0, material),
        mkBox(0.24, 0.36, 0.25, 0.05, 0.2, 0, material),
        leg
      );
    } else if (char === 'O') {
      letterGroup.add(mkBox(0.36, 0.76, 0.25, 0, 0, 0, material));
    } else if (char === 'Y') {
      const l = mkBox(0.12, 0.42, 0.25, -0.09, 0.2, 0, material); l.rotation.z = 0.4;
      const r = mkBox(0.12, 0.42, 0.25, 0.09, 0.2, 0, material); r.rotation.z = -0.4;
      const s = mkBox(0.12, 0.38, 0.25, 0, -0.2, 0, material);
      letterGroup.add(l, r, s);
    } else if (char === 'N') {
      const d = mkBox(0.12, 0.82, 0.25, 0, 0, 0, material); d.rotation.z = 0.35;
      letterGroup.add(
        mkBox(0.12, 0.76, 0.25, -0.11, 0, 0, material),
        d,
        mkBox(0.12, 0.76, 0.25, 0.11, 0, 0, material)
      );
    } else if (char === 'M') {
      const d1 = mkBox(0.1, 0.48, 0.25, -0.06, 0.14, 0, material); d1.rotation.z = -0.5;
      const d2 = mkBox(0.1, 0.48, 0.25, 0.06, 0.14, 0, material); d2.rotation.z = 0.5;
      letterGroup.add(
        mkBox(0.1, 0.76, 0.25, -0.14, 0, 0, material),
        d1, d2,
        mkBox(0.1, 0.76, 0.25, 0.14, 0, 0, material)
      );
    } else if (char === 'C') {
      letterGroup.add(
        mkBox(0.32, 0.14, 0.25, 0, 0.32, 0, material),
        mkBox(0.12, 0.48, 0.25, -0.11, 0, 0, material),
        mkBox(0.32, 0.14, 0.25, 0, -0.32, 0, material)
      );
    } else if (char === '!') {
      letterGroup.add(
        mkBox(0.14, 0.14, 0.25, 0, -0.32, 0, material),
        mkBox(0.14, 0.52, 0.25, 0, 0.1, 0, material)
      );
    }

    g.add(letterGroup);
  });

  return g;
}

function mkBox(w, h, d, x, y, z, mat) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}