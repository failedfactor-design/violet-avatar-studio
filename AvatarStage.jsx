import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function makeMannequin(rig = 'R15') {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#9f83ff', roughness: 0.64, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: '#28223f', roughness: 0.85 });
  const addBox = (name, size, pos, material = mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  addBox('Head', [0.8, 0.8, 0.8], [0, 2.6, 0]);
  addBox('Torso', [1.15, 1.1, 0.52], [0, 1.55, 0], dark);
  addBox('LeftArm', [0.42, rig === 'R6' ? 1.35 : 0.92, 0.42], [-0.86, rig === 'R6' ? 1.55 : 1.63, 0]);
  addBox('RightArm', [0.42, rig === 'R6' ? 1.35 : 0.92, 0.42], [0.86, rig === 'R6' ? 1.55 : 1.63, 0]);
  addBox('LeftLeg', [0.48, rig === 'R6' ? 1.25 : 0.95, 0.46], [-0.3, rig === 'R6' ? 0.42 : 0.55, 0], dark);
  addBox('RightLeg', [0.48, rig === 'R6' ? 1.25 : 0.95, 0.46], [0.3, rig === 'R6' ? 0.42 : 0.55, 0], dark);
  const eyesMat = new THREE.MeshBasicMaterial({ color: '#f8f5ff' });
  for (const x of [-0.19, 0.19]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.035), eyesMat);
    eye.position.set(x, 2.68, 0.415);
    root.add(eye);
  }
  return root;
}

export default function AvatarStage({ source, rig = 'R15', mode = 'mannequin', onError, onLoaded }) {
  const hostRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let frameId = 0;
    let loadedObject = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#100e1a');
    scene.fog = new THREE.Fog('#100e1a', 11, 24);
    const width = Math.max(host.clientWidth, 320);
    const height = Math.max(host.clientHeight, 320);
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);
    camera.position.set(0, 2.4, 7.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.65, 0);
    controls.minDistance = 2.4;
    controls.maxDistance = 11;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;

    scene.add(new THREE.HemisphereLight('#dcd2ff', '#211a36', 2.0));
    const key = new THREE.DirectionalLight('#ffffff', 3.1);
    key.position.set(4, 8, 6); key.castShadow = true; scene.add(key);
    const rim = new THREE.PointLight('#8f65ff', 20, 14);
    rim.position.set(-4, 3, -3); scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshStandardMaterial({ color: '#201a31', roughness: 0.95, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(8, 22, '#66509a', '#2b2441');
    grid.position.y = -0.065; scene.add(grid);

    const fit = (object) => {
      if (disposed) return;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      object.scale.multiplyScalar(3.8 / maxDim);
      object.position.y -= box.min.y * (3.8 / maxDim);
      scene.add(object);
      loadedObject = object;
      controls.target.set(0, 1.75, 0);
      camera.position.set(0, 2.35, 7.3);
      controls.update();
      setIsLoading(false);
      setLoadError('');
      onLoaded?.();
    };

    async function loadSceneObject() {
      setIsLoading(true); setLoadError('');
      try {
        if (mode === 'roblox' && source?.modelUrl) {
          const metaResponse = await fetch(source.modelUrl);
          if (!metaResponse.ok) throw new Error('Roblox 3D model metadata cannot be fetched');
          const meta = await metaResponse.json();
          const baseUrl = source.modelUrl.slice(0, source.modelUrl.lastIndexOf('/') + 1);
          const materialLoader = new MTLLoader();
          materialLoader.setPath(baseUrl);
          materialLoader.setResourcePath(baseUrl);
          const materials = await materialLoader.loadAsync(meta.mtl);
          materials.preload();
          const objectLoader = new OBJLoader();
          objectLoader.setMaterials(materials);
          objectLoader.setPath(baseUrl);
          const object = await objectLoader.loadAsync(meta.obj);
          fit(object);
        } else if (mode === 'file' && source?.url) {
          const extension = source.name?.split('.').pop()?.toLowerCase();
          if (extension === 'glb' || extension === 'gltf') {
            const gltf = await new GLTFLoader().loadAsync(source.url);
            fit(gltf.scene);
          } else if (extension === 'obj') {
            const object = await new OBJLoader().loadAsync(source.url);
            fit(object);
          } else {
            throw new Error('รองรับ .glb, .gltf และ .obj');
          }
        } else {
          fit(makeMannequin(rig));
        }
      } catch (error) {
        if (disposed) return;
        setIsLoading(false);
        setLoadError(error?.message || 'โหลดโมเดลไม่สำเร็จ');
        onError?.(error);
        if (!loadedObject) fit(makeMannequin(rig));
      }
    }
    loadSceneObject();

    const resizeObserver = new ResizeObserver(() => {
      if (!host.isConnected) return;
      const w = Math.max(host.clientWidth, 320), h = Math.max(host.clientHeight, 320);
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    resizeObserver.observe(host);
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => {
            Object.values(m).forEach((value) => { if (value?.isTexture) value.dispose(); });
            m.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [source?.modelUrl, source?.url, source?.name, mode, rig, onError, onLoaded]);

  return <div className="stage-wrap">
    <div className="three-host" ref={hostRef} />
    {isLoading && <div className="stage-state"><span className="spinner" />กำลังโหลดโมเดล…</div>}
    {loadError && <div className="stage-warning"><span>!</span><div><b>พรีวิว 3D โหลดไม่สำเร็จ</b><small>{loadError}</small></div></div>}
    <div className="stage-tip"><span className="dot-live" /> ลากเพื่อหมุน <span className="tip-divider">·</span> เลื่อนเพื่อซูม</div>
  </div>;
}
