import './style.css'

import * as THREE from 'three'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
// const backgroundColor = new THREE.Color( 'rgba(179, 221, 223, 1)' );
// scene.background = backgroundColor;

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
})

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(10);

const geometry = new THREE.RingGeometry( 2, 3, 4 );
console.log(geometry.attributes)
const rectangleColor = new THREE.Color( 'rgba(255, 255, 255, 1)' );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: rectangleColor, emissiveIntensity: 1});
const torus = new THREE.Mesh(geometry, material);

scene.add(torus);

// const buttonGeometry = new THREE.BoxGeometry( 10, 3, 10 );
// const buttonVertexShader = document.getElementById('buttonVertexShader').textContent;
// const buttonFragmentShader = document.getElementById('buttonFragmentShader').textContent;
// const buttonMaterial = new THREE.ShaderMaterial({ vertexShader:buttonVertexShader, fragmentShader: buttonFragmentShader});
// buttonMaterial.uniforms.uTime = {value:0};
// const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
// button.position.set(-30, -15, 0);
// button.rotation.set(0, Math.PI*0.25, 0);
// scene.add(button);

const loader = new GLTFLoader();
const loading = await loader.loadAsync( 'src/animations/intro.gltf' );
const loadingMesh = loading.scene
loadingMesh.material = new THREE.MeshStandardMaterial();
scene.add( loadingMesh );
loadingMesh.position.set(0, 0, 2)

const mixer = new THREE.AnimationMixer( loadingMesh );
const clips = loading.animations;

play_clip("loading")

const pointLight = new THREE.PointLight(0xffffff, 100)
pointLight.position.set(0, 0, 5)

scene.add(pointLight);

const composer = new EffectComposer( renderer );

const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );

const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass( resolution, 1, 0.4, 0.85 );
composer.addPass( bloomPass );

const clock = new THREE.Clock();
let introPlayed = false;
function animate() {
  requestAnimationFrame(animate);
  mixer.update(clock.getDelta());
  if (clock.elapsedTime > 1.0 && !introPlayed){
    introPlayed = true;
    // play_clip("intro")
  }
  composer.render();
}

function play_clip(clipName) {
  const clip = THREE.AnimationClip.findByName( clips, clipName );
  const animation = mixer.clipAction( clip );
  animation.play();
}

animate()