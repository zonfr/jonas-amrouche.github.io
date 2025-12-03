import './style.css'

import * as THREE from 'three'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap/gsap-core';

let targetStartLinksRotation = new THREE.Vector3();

let introDone = false;
let screenTouched = false;
let volumeMuted = false;

let scrollDisabled = false;
let scrollPercent = 0.0;
let scrollTarget = 0.0;
let previousScrollPercent = 0.0
let scrollSpeed = 0.0;

let projectLights = [];
let videosPlayers = [];

let projectShown = "";
let tabShown = "";
let projects = ["Firelive", "Elumin", "ServerMeshing", "Metronim"]

// Create 3D renderer
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg') });

// Create scene and camera
const scene = new THREE.Scene();
const cameraSocket = new THREE.Object3D();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(cameraSocket);
cameraSocket.add(camera);
cameraSocket.position.set(0, 0, 8);

//TO FIX
const loadingManager = new THREE.LoadingManager();

loadingManager.onLoad = () => {
  if (!skipIntro){
    document.getElementById("enter-text").style.visibility = "visible";
  }
}

// Create distorsion black hole
  const distortionShader = {
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        sphereRadius: { value: 0.0},
        sphereCenter: { value: new THREE.Vector3(0.0, 0.0, 0.0)},
        eventHorizonRadius: { value: 0.0},
        gravityStrength: { value: 0.0},
        // ior: { value: 5.5},
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform float sphereRadius;
        uniform vec3 sphereCenter;
        uniform float eventHorizonRadius; // Inner black circle radius
        uniform float gravityStrength; // Control distortion intensity
        varying vec2 vUv;

        void main() {
          vec2 centeredUv = (vUv - 0.5) * 2.0;
          centeredUv.x *= resolution.x / resolution.y;
          
          // Ray setup
          vec3 rayOrigin = vec3(0.0, 0.0, -3.0);
          vec3 rayDir = normalize(vec3(centeredUv, 1.0));
          
          // Calculate distance from sphere center in screen space
          vec2 screenSpaceCenter = sphereCenter.xy;
          float distToCenter = length(centeredUv - screenSpaceCenter);
          
          vec2 finalUv = vUv;
          
          // Black hole effect parameters
          float outerRadius = sphereRadius;
          float innerRadius = eventHorizonRadius > 0.0 ? eventHorizonRadius : 0.001;
          
          // Apply gravitational lensing if within influence radius
          if (distToCenter < outerRadius) {
            // Calculate normalized distance (0 at edge, 1 at center)
            float normalizedDist = 1.0 - (distToCenter / outerRadius);
            
            // Smooth falloff for gradual distortion (stronger near center)
            float distortionFactor = smoothstep(0.0, 1.0, normalizedDist);
            distortionFactor = pow(distortionFactor, 2.0); // Quadratic falloff
            
            // Direction from center to current pixel
            vec2 toCenter = screenSpaceCenter - centeredUv;
            vec2 dirToCenter = normalize(toCenter);
            
            // Gravitational pull toward center (stronger as you get closer)
            float pullStrength = distortionFactor * (gravityStrength > 0.0 ? gravityStrength : 0.5);
            
            // Add swirl/rotation effect for accretion disk look
            float angle = atan(toCenter.y, toCenter.x);
            float rotation = distortionFactor * distortionFactor * 0.5;
            vec2 rotatedDir = vec2(
              cos(angle + rotation) * length(toCenter),
              sin(angle + rotation) * length(toCenter)
            );
            
            // Combine pull and rotation
            vec2 distortion = dirToCenter * pullStrength * 0.3 + 
                              (rotatedDir - toCenter) * distortionFactor * 0.2;
            
            // Apply distortion in UV space
            vec2 aspectRatio = vec2(resolution.x / resolution.y, 1.0);
            finalUv = vUv + distortion / aspectRatio * 0.5;
            
            // Create event horizon (pure black)
            if (distToCenter < innerRadius) {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
              return;
            }
          }
          
          // Clamp and sample texture
          finalUv = clamp(finalUv, 0.0, 1.0);
          vec4 color = texture2D(tDiffuse, finalUv);
          
          // Optional: Add slight darkening near black hole edge
          if (distToCenter < outerRadius && distToCenter > innerRadius) {
            float edgeDist = (distToCenter - innerRadius) / (outerRadius - innerRadius);
            float darken = smoothstep(0.0, 0.5, edgeDist);
            color.rgb *= mix(0.3, 1.0, darken);
          }
          
          gl_FragColor = color;
        }
      `
    };

const distortionMaterial = new THREE.ShaderMaterial(distortionShader);

// Add post-processing
const composer = new EffectComposer( renderer );
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
const fxaaPass = new FXAAPass();
composer.addPass( fxaaPass );
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass( resolution, 0.5, 0.4, 0.7 );
composer.addPass( bloomPass );
const shaderPass = new ShaderPass(distortionMaterial);
composer.addPass( shaderPass );
const outputPass = new OutputPass();
composer.addPass(outputPass);

updateSreenSize();

// Setup and play animations.gltf
const loader = new GLTFLoader(loadingManager);
const animLoaded = await loader.loadAsync( '/animations.glb' );
const loadingMesh = animLoaded.scene
const mixer = new THREE.AnimationMixer( loadingMesh );
scene.add( loadingMesh );
const mask = loadingMesh.getObjectByName("Mask");
const Windows = loadingMesh.getObjectByName("Windows");
const props = loadingMesh.getObjectByName("Props")
const projectStar = loadingMesh.getObjectByName("ProjectStar")
projectStar.material.emissiveIntensity = 0.0;
// const starLinks = loadingMesh.getObjectByName("Links")
// starLinks.material.emissiveIntensity = 0.0;
props.visible = false;
Windows.visible = false;
Windows.frustumCulled = false;

// Setup texture loader
const textureLoader = new THREE.TextureLoader(loadingManager);

const alphaMap = textureLoader.load("/hologram_alpha.jpg")
alphaMap.minFilter = THREE.LinearMipMapNearestFilter;
alphaMap.magFilter = THREE.NearestFilter;
alphaMap.generateMipmaps = true;
alphaMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

const hoverMap = textureLoader.load("/hologram_hover.jpg")
hoverMap.minFilter = THREE.LinearMipMapNearestFilter;
hoverMap.magFilter = THREE.NearestFilter;
hoverMap.generateMipmaps = true;
hoverMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Declare projects 3D buttons and assign materials
const fireliveScreen = loadingMesh.getObjectByName("Firelive");
const fireliveScreenMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/firelive_screen_emi.jpg"), emissive:0xffffff, emissiveMap: hoverMap, emissiveIntensity:0.0, alphaMap: alphaMap, transparent:true, alphaTest:true } );
fireliveScreen.material = fireliveScreenMaterial;
const eluminScreen = loadingMesh.getObjectByName("Elumin");
const eluminScreenMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/elumin_screenshot2.jpg"), emissive:0xffffff, emissiveMap: hoverMap, emissiveIntensity:0.0, alphaMap: alphaMap, transparent:true, alphaTest:true } );
eluminScreen.material = eluminScreenMaterial
const serverMeshingScreen = loadingMesh.getObjectByName("ServerMeshing");
const serverMeshingMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/server_meshing_screenshot_1.png"), emissive:0xffffff, emissiveMap: hoverMap, emissiveIntensity:0.0, alphaMap: alphaMap, transparent:true, alphaTest:true } );
serverMeshingScreen.material = serverMeshingMaterial;
const metronimScreen = loadingMesh.getObjectByName("Metronim");
const metronimMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/metronim_screenshot1.jpg"), emissive:0xffffff, emissiveMap: hoverMap, emissiveIntensity:0.0, alphaMap: alphaMap, transparent:true, alphaTest:true } );
metronimScreen.material = metronimMaterial;

// Play loading animation
const loading_anim = play_clip(animLoaded, mixer, "loading", false);

// Create glowy quad-ring
const geometry = new THREE.RingGeometry( 2, 3, 4 );
const rectangleColor = new THREE.Color( 'rgba(255, 255, 255, 1)' );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: rectangleColor, emissiveIntensity: 1});
const torus = new THREE.Mesh(geometry, material);
torus.position.set(0, 0, -2)
scene.add(torus);

// Create animated wireframe tunel
const tunnelGeometry = new THREE.CylinderGeometry( 5, 5, 60, 50, 100, true);
const tunnelVertexShader = `
      uniform float uTime;

      varying vec3 vPosition;
      varying vec3 vNormal;

      float random (in vec2 st) {
        return fract(sin(dot(st.xy,
                            vec2(12.9898,78.233)))
                    * 43758.5453123);
      }
      float noise (in vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        // Smooth Interpolation

        // Cubic Hermine Curve.  Same as SmoothStep()
        vec2 u = f*f*(3.0-2.0*f);
        // u = smoothstep(0.,1.,f);

        // Mix 4 coorners percentages
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }

    void main(){
        float noise1 = noise(position.yz * 4.0 + (uTime * vec2(0.3, 1.2)));
        float noise2 = noise(position.yz * 2.0 + (uTime * vec2(-0.9, -0.3)));
        vec3 newPosition = position - normal * noise1 * noise2 * 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
        vNormal = normal;
        vPosition = newPosition;
    }
`;
const tunnelFragmentShader = `
      uniform float uTime;
      uniform float uOpacity;
      
      varying vec3 vPosition;
      varying vec3 vNormal;

      const vec3 cColor = vec3(1.0, 1.0, 1.0);
      
      void main(){
        vec3 depthColor = cColor * clamp(distance(vPosition.zx, vec2(0.0, 0.0))*5.0-24.5, 0.0, 1.0);
        
        gl_FragColor = vec4(depthColor * uOpacity, 1.0);
      }
`;
const tunnelMaterial = new THREE.ShaderMaterial( {
  vertexShader:tunnelVertexShader,
  fragmentShader:tunnelFragmentShader,
  wireframe:true,
  uniforms : {
    uTime:0.0,
    uOpacity:0.0
  }});
const tunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelMaterial);
tunnelMesh.position.set(0, 0, -130.0)
tunnelMesh.rotation.set(Math.PI/2.0, 0, 0)
scene.add(tunnelMesh);

// Setup sounds
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add( listener );

// Setup base ambient sound
const ambientSound = new THREE.Audio( listener );
audioLoader.load( '/note_b_loop.ogg', function( buffer ) {
  ambientSound.setBuffer( buffer );
  ambientSound.setLoop( true );
  ambientSound.setVolume( 0.0 );
});

// Setup loading sound
const loadingSound = new THREE.Audio( listener );
audioLoader.load( '/loading_loop.ogg', function( buffer ) {
  loadingSound.setBuffer( buffer );
  loadingSound.setLoop( true );
  loadingSound.setVolume( 2.0 );
  if (!skipIntro){
    loadingSound.play();
  }
});

// Setup FX sounds
const blackHoleSound = new THREE.Audio( listener );
audioLoader.load( '/black_hole_1.ogg', function( buffer ) {
  blackHoleSound.setBuffer( buffer );
  blackHoleSound.setLoop( false );
  blackHoleSound.setVolume( 1.0 );
});
const reverseBlackHoleSound = new THREE.Audio( listener );
audioLoader.load( '/black_hole_2.ogg', function( buffer ) {
  reverseBlackHoleSound.setBuffer( buffer );
  reverseBlackHoleSound.setLoop( false );
  reverseBlackHoleSound.setVolume( 1.0 );
});

// Setup intro sound
const introSound = new THREE.Audio( listener );
audioLoader.load( '/intro_sound.ogg', function( buffer ) {
  introSound.setBuffer( buffer );
  introSound.setLoop( false );
  introSound.setVolume( 1.0 );
});

// Quad Ring Point light
const pointLight = new THREE.PointLight(0xffffff, 100, 10);
pointLight.position.set(0, 0, 3);
scene.add(pointLight);

// Create clock for animations
const clock = new THREE.Clock();

projectLights.push([projectLight("/flashreel.webm", 0, 0), 100])
projectLights.push([projectLight("/firelive_screen1_blured.jpg", -20, 0), 200])
projectLights.push([projectLight("/elumin_screen_blurred_1.png", 20, 0), 200])
projectLights.push([projectLight("/firelive_screen1_blured.jpg", -20, -20.3), 500])
projectLights.push([projectLight("/elumin_screen_blurred_2.png", 20, 20.3), 200])
projectLights.push([projectLight("/metronim_screenshot4_blurred.jpg", 40, 40.3), 200])
projectLights.push([projectLight("/server_meshing_screenshot_2_blurred.png", -40, -40.3), 200])

// Project lights
function projectLight(texture_path, x_pos, x_target) {
  let texture;
  if (texture_path.split('.')[texture_path.split('.').length-1] == "webm"){
    // Create video and play
    const textureVid = document.createElement("video")
    textureVid.src = texture_path; // transform gif to mp4
    textureVid.loop = true;
    videosPlayers.push(textureVid);

    // Load video texture
    const videoTexture = new THREE.VideoTexture(textureVid);
    videoTexture.format = THREE.RGBFormat;
    videoTexture.minFilter = THREE.NearestFilter;
    videoTexture.magFilter = THREE.NearestFilter;
    videoTexture.generateMipmaps = false;
    texture = videoTexture;
  }else{
    texture = textureLoader.load(texture_path);
  }
  const projectLight = new THREE.SpotLight(0xffffff, 0, 200, Math.PI/4, 1.0);
  scene.add(projectLight);
  projectLight.map = texture;
  projectLight.position.set(x_pos, 0, -170);
  projectLight.target.position.set(x_target, 0, -177);
  scene.add(projectLight.target);

  return projectLight
}

const raycaster = new THREE.Raycaster();

const tab2DBackContainer = document.getElementById('tab2DBackContainer')
const projectContainers = document.getElementsByClassName('project-container')
const scrollBox = document.getElementById("scroll-box")
const backButton = document.getElementById("backButton")
const metronimMoreButton = document.getElementById("metronimMoreButton")
const fireliveMoreButton = document.getElementById("fireliveMoreButton")
const eluminMoreButton = document.getElementById("eluminMoreButton")
const serverMeshingMoreButton = document.getElementById("serverMeshingMoreButton")

// Connect Event listeners
window.addEventListener('resize', updateSreenSize);
document.getElementById("toggleSoundButton").addEventListener("click", soundButtonClick);
document.getElementById("behindTheScenesButton").addEventListener("click", devButtonClick);
document.getElementById("bioButton").addEventListener("click", bioButtonClick);
for (let i = 0; i< projectContainers.length; i++){
  projectContainers[i].addEventListener("mousemove", onMouseMove)
}
tab2DBackContainer.addEventListener('click', close2DTabs)
scrollBox.addEventListener("mousemove", onMouseMove)
backButton.addEventListener("click", closeProject);
backButton.addEventListener("mouseover", () => {backButton.style.opacity = "90%"})
backButton.addEventListener("mouseout", () => {backButton.style.opacity = "20%"})
scrollBox.addEventListener("click", backgroundClick);
scrollBox.addEventListener("scroll", updateScrollValue);
scrollBox.addEventListener('touchstart', handleTouchStart, false);        
scrollBox.addEventListener('touchmove', handleTouchMove, false);
metronimMoreButton.addEventListener("click", (event) => {open2DTabs('MetronimMore');})
fireliveMoreButton.addEventListener("click", (event) => {open2DTabs('FireliveMore');})
serverMeshingMoreButton.addEventListener("click", (event) => {open2DTabs('ServerMeshingMore');})
eluminMoreButton.addEventListener("click", (event) => {open2DTabs('EluminMore');})

let mouseCoords = new THREE.Vector2(0.0, 0.0)
function onMouseMove(event){
  mouseCoords = new THREE.Vector2(event.clientX / renderer.domElement.clientWidth * 2 - 1, -(event.clientY / renderer.domElement.clientHeight * 2 - 1));
  targetStartLinksRotation = new THREE.Vector3(-mouseCoords.y*0.1, mouseCoords.x*0.1, 0.0);
  updateHover3D()
}

function updateHover3D(){
  raycaster.setFromCamera(mouseCoords, camera);
  const intersections = raycaster.intersectObjects(scene.children, true);

  let hoveringSomething = false;

  if (intersections.length > 0){
    for (let i = 0; i < projects.length; i++){
      if (intersections[0].object.name === projects[i] && !inProjectTransition){
        const screen = loadingMesh.getObjectByName(projects[i]);
        screen.material.emissiveIntensity = 1.0;
        document.body.style.cursor = "pointer";
        hoveringSomething = true;
      }
    }
  }else{
    for (let i = 0; i < projects.length; i++){
      const screen = loadingMesh.getObjectByName(projects[i]);
      screen.material.emissiveIntensity = 0.0;
      document.body.style.cursor = "default";
    }
  }

  if (!hoveringSomething){
    for (let i = 0; i < projects.length; i++){
      const screen = loadingMesh.getObjectByName(projects[i]);
      screen.material.emissiveIntensity = 0.0;
    }
    document.body.style.cursor = "default";
  }
}

var xDown = null;
var yDown = null;

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
};

function handleTouchMove(evt) {
    if ( ! xDown || ! yDown ) {
        return;
    }

    var xUp = evt.touches[0].clientX;
    var yUp = evt.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;
    
    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/*most significant*/
        if ( xDiff > 0 ) {
            scrollPercent = Math.min(100.0, scrollPercent + 20.0)
        } else {
            scrollPercent = Math.max(0.0, scrollPercent - 20.0)
        }
    }
    /* reset values */
    xDown = null;
    yDown = null;
};

// Dev only
let skipIntro = false;
if (skipIntro){
  cameraSocket.position.set(0, 0, -167);
  camera.fov = 50.0;
  camera.updateProjectionMatrix();
  play_clip(animLoaded, mixer, "floating", false);
  torus.visible = false;
  mask.visible = false;
  Windows.visible = true;
  tunnelMesh.visible = false;
  props.visible = true;
  ambientSound.setVolume(2.0)
  ambientSound.play();

  for(var i=0; i<projectLights.length; i++){
    projectLights[i][0].intensity = projectLights[i][1];
  }

  var elements = document.querySelectorAll('.project-ui');
  for(var i=0; i<elements.length; i++){
    elements[i].style.opacity = "100%";
  }

  tunnelMesh.material.uniforms.uOpacity = {value : 1.0}
  introDone = true;
  scrollBox.style.overflow = "scroll";
  scrollBox.scrollTop = 750.0
  scrollBox.scrollLeft = 750.0
  previousScrollPercent = 50.0
  scrollPercent = 50.0
}

updateSreenSize();

function animate() {
  requestAnimationFrame(animate);

  // Updates animations times
  mixer.update(clock.getDelta());
  tunnelMesh.material.uniforms.uTime = {value : clock.elapsedTime};

  updateScroll();

  triggerEnter();

  updateCamScrollSpeed();

  updateProjectRotation();
  
  // Render scene
  composer.render();
}

animate()

function updateCamScrollSpeed(){
  if (!introDone && !scrollDisabled){return}
  const speedDifference = scrollPercent - previousScrollPercent
  scrollSpeed = THREE.MathUtils.lerp(scrollSpeed, speedDifference, 0.1)
  

  cameraSocket.rotation.set(0, -scrollSpeed*0.1, 0.0)
  // const scrollPos = Math.round(((scrollPercent-50)*0.8)/20.0) * 20.0
  // rotationLerp = THREE.MathUtils.lerp(rotationLerp, Math.min(Math.max((scrollTarget - scrollPos)*0.1, -Math.PI/3.0), Math.PI/3.0), 0.1)
  // cameraSocket.rotation.set(0, rotationLerp, 0.0)


  previousScrollPercent = scrollPercent
}

function updateProjectRotation(){
  if (projectStar !== null){
    const rot1 = projectStar.rotation
    const rot2 = targetStartLinksRotation
    projectStar.rotation.set(THREE.MathUtils.lerp(rot1.x, rot2.x, 0.1), THREE.MathUtils.lerp(rot1.y, rot2.y, 0.1), 0.0)
  }
}

function updateScroll(){
  if (introDone && !scrollDisabled){

    const scrollPosition = Math.round(((scrollPercent-50)*0.8)/20.0) * 20.0
    // const travellingPos = ((scrollPercent-50)*0.8 - Math.round(((scrollPercent-50)*0.8)/20.0) * 20.0)*0.2
    scrollTarget = THREE.MathUtils.lerp(scrollTarget, scrollPosition, 0.1)
    cameraSocket.position.set(scrollTarget, cameraSocket.position.y, cameraSocket.position.z);
  }
}

function play_clip(gltfLoad, mixer, clipName, oneShot) {
  const clips = gltfLoad.animations;
  const clip = THREE.AnimationClip.findByName( clips, clipName );
  const animation = mixer.clipAction( clip );
  animation.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat)
  animation.play();
  return animation
}

function updateSreenSize(){
  distortionMaterial.uniforms.resolution = { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(window.devicePixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.position.set(0, 0, window.innerHeight / window.innerWidth * 8.0 - 4.0)
  fxaaPass.uniforms['resolution'].value.set(1 / (window.innerWidth * window.devicePixelRatio), 1 / (window.innerHeight * window.devicePixelRatio));
  // for(var i=0; i<projectLights.length; i++){
  //   const pos = projectLights[i][0].position
  //   projectLights[i][0].position.set(pos.x, pos.y, -170 + window.innerHeight / window.innerWidth * 8.0 - 4.0)
  // }
}

function closeProject(){
  if (projectShown !== ""){
    toggleProject("")
    return
  }
}

function backgroundClick(){
  const intersections = raycaster.intersectObjects(scene.children, true);

  if (intersections.length > 0){
    raycastClick(intersections[0].object.name)
  }
  
  //Dev Only
  if (skipIntro){
    for(var i=0; i<videosPlayers.length; i++){
      videosPlayers[i].play()
    }
    return;
  }

  // Intro Play
  screenTouched = true
  document.getElementById("enter-text").style.visibility = "hidden"
  ambientSound.play();
}

function raycastClick(raycastedObject){
  for (let i = 0; i < projects.length; i++){
    if (raycastedObject === projects[i]){
      toggleProject(projects[i]);
    }
  }
}

function toggleProject(projectName){
  if (!inProjectTransition){
    if (projectShown === ""){
      scrollDisabled = true
      projectTransition(projectName, 1.0)
      projectShown = projectName
      scrollBox.style.overflow = "hidden";
    }else{
      projectTransition(projectShown, 0.0)
      projectShown = ""
      updateHover3D()
    }
  }
}

// Manage projects tranistions animations
let inProjectTransition = false
function projectTransition(tabName, val){
  inProjectTransition = true
  
  const projectContainer = document.getElementById(tabName);

  let obj = { value: val === 1.0 ? 0.0 : 1.0 };
  gsap.to(obj, {
    delay: val === 1.0 ? 0.0 : 1.0,
    value: val,
    duration: 1.0,
    ease: "power2.inOut",
    onStart:() =>{
      if (val === 1.0){
        blackHoleSound.play();
      }else{
        reverseBlackHoleSound.play();
      }
    },
    onUpdate: () => {
      distortionMaterial.uniforms.sphereRadius.value = obj.value * 7.5; // 0.5
      distortionMaterial.uniforms.gravityStrength.value = obj.value * 5.0; // 5.0
    },
    onComplete: () => {
      if (val === 1.0){
        cameraSocket.position.set(0, 60, -130)
        projectContainer.style.visibility = "visible"
        backButton.style.visibility = "visible"
      }else{
        inProjectTransition = false
        projectContainer.style.visibility = "hidden"
        backButton.style.visibility = "hidden"
      }
      distortionMaterial.uniforms.sphereRadius.value = 0.0;
      distortionMaterial.uniforms.gravityStrength.value = 0.0;
    }
  });

  gsap.to(distortionMaterial.uniforms.eventHorizonRadius, {
    value: val * 3.5,
    delay: val === 1.0 ? 0.3 : 1.0,
    duration: 0.7,
    ease: "power2.inOut",
  });

  let starObj = { value: val === 1.0 ? 0.0 : 1.0 };
  gsap.to(starObj, {
    value: val,
    delay: val === 1.0 ? 1.0 : 0.0,
    duration: 0.7,
    ease: "power2.inOut",
    onUpdate: () => {
      projectStar.material.emissiveIntensity = starObj.value;
      projectContainer.style.opacity = (starObj.value * 100.0).toString() + "%";
      backButton.style.opacity = (starObj.value * 40.0).toString() + "%";
    },
    onComplete: () => {
      if (val === 0.0){
        distortionMaterial.uniforms.sphereRadius.value = 7.5;
        distortionMaterial.uniforms.gravityStrength.value = 5.0;
        cameraSocket.position.set((scrollTarget-50)*0.8, 0, -167)
        scrollDisabled = false
        scrollBox.style.overflow = "scroll";
      }else{
        inProjectTransition = false
      }
    }
  });

}

function open2DTabs(tabName){
  close2DTabs(tabShown);
  console.log(tabName)
  transition2Dtabs(tabName, 100.0);

  document.getElementById('bg').style.pointerEvents= "none";

  tabShown = tabName;
}

function close2DTabs(){
  if (tabShown !== ""){

    transition2Dtabs(tabShown, 0.0);

    document.getElementById('bg').style.pointerEvents= "all";
    tabShown = "";
  }
}

// Manage 2D tabs transitions animations
let tween2Dtabs
function transition2Dtabs(tabName, val){

  const tab2DContainer = document.getElementById(tabName);

  if (tween2Dtabs && tween2Dtabs.isActive()){
    tween2Dtabs.onComplete = () => {
      transition2Dtabs(tabName, val)
    };
  }

  let opacityObj = { value: val === 100.0 ? 0.0 : 100.0 };
  tween2Dtabs = gsap.to(opacityObj, {
    value: val,
    duration: 0.3,
    ease: "power2.inOut",
    onUpdate: () => {
      tab2DContainer.style.opacity =(opacityObj.value * 0.9).toString() + "%";
      tab2DBackContainer.style.opacity = (opacityObj.value * 0.9).toString() + "%";
    },
    onComplete: () => {
      update2DTabsVisiblity(tabName, val === 0.0 ? "hidden" : "visible", val)
    }
  });
  if (val === 100.0){
    update2DTabsVisiblity(tabName, "visible", 0.0);
  }
}

function update2DTabsVisiblity(tabName, visibility, value){

  const tab2DContainer = document.getElementById(tabName);

  tab2DBackContainer.style.opacity = (value * 0.9).toString() + "%"
  tab2DContainer.style.opacity = (value * 0.9).toString() + "%"
  tab2DBackContainer.style.visibility = visibility;
  tab2DContainer.style.visibility = visibility;
}

function soundButtonClick(){
  if (volumeMuted){
    ambientSound.setVolume(2.0)
    introSound.setVolume(1.0);
    loadingSound.setVolume(2.0);
    blackHoleSound.setVolume(1.0);
    reverseBlackHoleSound.setVolume(1.0);
    document.getElementById("not-muted-icon").style.visibility = "visible";
    document.getElementById("muted-icon").style.visibility = "hidden";
  }else{
    ambientSound.setVolume(0.0);
    introSound.setVolume(0.0);
    loadingSound.setVolume(0.0);
    blackHoleSound.setVolume(0.0);
    reverseBlackHoleSound.setVolume(0.0);
    document.getElementById("not-muted-icon").style.visibility = "hidden";
    document.getElementById("muted-icon").style.visibility = "visible";
  }
  volumeMuted = !volumeMuted;
}

function devButtonClick(){
  if (tabShown === "BehindTheScenes"){
    close2DTabs();
  }else{
    open2DTabs("BehindTheScenes");
  }
}

function bioButtonClick(){
  if (tabShown === "Bio"){
    close2DTabs();
  }else{
    open2DTabs("Bio");
  }
}

function updateScrollValue(){
  if (!scrollDisabled && scrollBox.scrollTop && window.innerWidth > 768){
    const scrollPercentY = scrollBox.scrollTop / (scrollBox.scrollHeight - document.documentElement.clientHeight) * 100.0;
    scrollPercent = scrollPercentY;
  }
}

let introTriggered = false
function triggerEnter(){
  if (loading_anim.time < 0.1 && screenTouched && !introTriggered){
    screenTouched = false
    introTriggered = true
    enter()
  }
}

function enter(){
  if (skipIntro){ return; }

  introSound.play();
  loadingSound.stop();
    gsap.to(mixer, {
      timeScale: 5.575,
      duration: 6.0,
      ease: "power2.inOut",
      onComplete: () => {
        mixer.timeScale = 1.0;
        gsap.to(torus.scale, {
          x: 10,
          y: 10,
          z: 10,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            torus.visible = false;
            mask.visible = false;
            Windows.visible = true;
            tunnelMesh.material.uniforms.uOpacity = {value : 0.0}
            play_clip(animLoaded, mixer, "intro", true)
            gsap.to(camera, {
              fov: 100,
              duration: 0.5,
              ease: "power2.inOut",
              onUpdate: () => {
                camera.updateProjectionMatrix();
              },
              onComplete: () => {
                ambientSound.play();
                let soundObj = { value: 0 };
                gsap.to(soundObj, {
                  value: 2.0,
                  duration: 4.0,
                  ease: "expo.in",
                  onUpdate: () => {
                    if (!volumeMuted){
                    ambientSound.setVolume(soundObj.value);
                    }
                  }
                });

                let projectorsObj = { value: 0 };
                gsap.to(projectorsObj, {
                  value: 1.0,
                  delay:4.0,
                  duration: 2,
                  ease: "power2.inOut",
                  onUpdate: () => {
                    for(var i=0; i<projectLights.length; i++){
                      projectLights[i][0].intensity = projectLights[i][1] * projectorsObj.value;
                    }
                  }
                });
                    
                gsap.to(tunnelMesh.material.uniforms.uOpacity, {
                  delay: 2.5,
                  value: 1.0,
                  duration: 2.0,
                  ease: "power2.out",
                });
                gsap.to(camera, {
                  delay: 2.5,
                  fov: 50.0,
                  duration: 1.0,
                  ease: "power2.out",
                  onUpdate: () => {
                    camera.updateProjectionMatrix();
                  },
                });
                gsap.to(cameraSocket.position, {
                  x: 0,
                  y: 0,
                  z: -167,
                  duration: 5,
                  ease: "power2.inOut",
                  onComplete: () => {
                    props.visible = true;

                  }
                });
                gsap.to(cameraSocket.rotation, {
                  x: 0,
                  y: 0,
                  z: Math.PI*2.0,
                  duration: 4,
                  ease: "power2.inOut",
                  onComplete: () => {
                    for(var i=0; i<videosPlayers.length; i++){
                      videosPlayers[i].play()
                    }
                    introDone = true;
                    play_clip(animLoaded, mixer, "floating", false)
                    scrollBox.style.overflow = "scroll";
                    tunnelMesh.visible = false;
                    scrollBox.scrollTop = 750.0
                    scrollBox.scrollLeft = 750.0
                    previousScrollPercent = 50.0
                    scrollPercent = 50.0
                  }
                });
              }
            });
          }
        });
      }
    });
}