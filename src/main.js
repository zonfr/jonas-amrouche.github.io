import './style.css'

import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap/gsap-core';

// const pageSize = 5000;

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
let projects = ["Firelive", "Elumin", "ServerMeshing"]

// Create 3D renderer
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg') });

// Create 2D HTLM renderer
const flatRenderer = new CSS2DRenderer();
document.body.appendChild(flatRenderer.domElement);
flatRenderer.domElement.id = "flat-renderer"

// Create scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8)

// Create distorsion black hole
  const distortionShader = {
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        sphereRadius: { value: 0.0},
        sphereCenter: { value: new THREE.Vector3(-0.15, 0.04, 0.0)},
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
const loader = new GLTFLoader();
const animLoaded = await loader.loadAsync( '/animations.glb' );
const loadingMesh = animLoaded.scene
const mixer = new THREE.AnimationMixer( loadingMesh );
scene.add( loadingMesh );
const mask = loadingMesh.getObjectByName("Mask");
const Windows = loadingMesh.getObjectByName("Windows");
const lighthouse = loadingMesh.getObjectByName("LightHouse")
const props = loadingMesh.getObjectByName("Props")
const starLinks = loadingMesh.getObjectByName("Links")
starLinks.material.emissiveIntensity = 0.0;
lighthouse.visible = false;
props.visible = false;
Windows.visible = false;
Windows.frustumCulled = false;

// Setup texture loader
const textureLoader = new THREE.TextureLoader();

// Declare projects 3D buttons and assign materials
const fireliveScreen = loadingMesh.getObjectByName("Firelive");
const fireliveScreenMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/firelive_screen_emi.jpg"), emissive:0xffffff, emissiveMap: textureLoader.load("/hologram_hover.jpg"), emissiveIntensity:0.0, alphaMap: textureLoader.load("/hologram_alpha.jpg"), transparent:true, alphaTest:true } );
fireliveScreen.material = fireliveScreenMaterial;
const eluminScreen = loadingMesh.getObjectByName("Elumin");
const eluminScreenMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/elumin_screenshot2.jpg"), emissive:0xffffff, emissiveMap: textureLoader.load("/hologram_hover.jpg"), emissiveIntensity:0.0, alphaMap: textureLoader.load("/hologram_alpha.jpg"), transparent:true, alphaTest:true } );
eluminScreen.material = eluminScreenMaterial
const serverMeshingScreen = loadingMesh.getObjectByName("ServerMeshing");
const serverMeshingMaterial = new THREE.MeshStandardMaterial( { map: textureLoader.load("/server_meshing_screenshot_2.png"), emissive:0xffffff, emissiveMap: textureLoader.load("/hologram_hover.jpg"), emissiveIntensity:0.0, alphaMap: textureLoader.load("/hologram_alpha.jpg"), transparent:true, alphaTest:true } );
serverMeshingScreen.material = serverMeshingMaterial;

// Play loading animation
const loading_anim = play_clip(animLoaded, mixer, "loading", false);

// Enter Text Label
const enterTextP = document.createElement("p");
enterTextP.textContent = "click to enter my portfolio";
enterTextP.id = "enter-text";
const enterTextLabel = new CSS2DObject(enterTextP);
scene.add(enterTextLabel);
enterTextLabel.position.set(0, -3, 2);

// Create glowy quad-ring
const geometry = new THREE.RingGeometry( 2, 3, 4 );
const rectangleColor = new THREE.Color( 'rgba(255, 255, 255, 1)' );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: rectangleColor, emissiveIntensity: 1});
const torus = new THREE.Mesh(geometry, material);
torus.position.set(0, 0, -2)
scene.add(torus);

// Create animated wireframe tunel
const pageGridGeometry = new THREE.CylinderGeometry( 5, 5, 60, 50, 100, true);
const pageGridVertexShader = document.getElementById('tunnelVertexShader').textContent;
const pageGridFragmentShader = document.getElementById('tunnelFragmentShader').textContent;
const pageGridMaterial = new THREE.ShaderMaterial( {
  vertexShader:pageGridVertexShader,
  fragmentShader:pageGridFragmentShader,
  wireframe:true,
  uniforms : {
    uTime:0.0,
    uOpacity:0.0
  }});
const pageGrid = new THREE.Mesh(pageGridGeometry, pageGridMaterial);
pageGrid.position.set(0, 0, -130.0)
pageGrid.rotation.set(Math.PI/2.0, 0, 0)
scene.add(pageGrid);

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
  loadingSound.play();
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

projectLights.push([projectLight("/flashreel.webm", 0, 0, 0), 100])
projectLights.push([projectLight("/firelive_screen1_blured.jpg", -20, 0, 0), 200])
projectLights.push([projectLight("/elumin_screen_blurred_1.png", 20, 0, 0), 200])
projectLights.push([projectLight("/firelive_screen1_blured.jpg", -20, 0, -20.3), 500])
projectLights.push([projectLight("/elumin_screen_blurred_2.png", 20, 0, 20.3), 200])
projectLights.push([projectLight("/shift_up_screenshot3.png", 40, 0, 40.3), 200])
projectLights.push([projectLight("/server_meshing_screenshot_1.png", -40, 0, -40.3), 200])

// Project lights
function projectLight(texture_path, x_pos, z_pos, x_target) {
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
  projectLight.position.set(x_pos, z_pos, -170);
  projectLight.target.position.set(x_target, 0, -177);
  scene.add(projectLight.target);

  return projectLight
}

const raycaster = new THREE.Raycaster();

const backContainer = document.getElementById('backContainer')
const scrollBox = document.getElementById("scroll-box")

// Connect Event listeners
window.addEventListener('resize', updateSreenSize);
document.getElementById("toggleSoundButton").addEventListener("click", soundButtonClick);
document.getElementById("behindTheScenesButton").addEventListener("click", devButtonClick);
document.getElementById("bioButton").addEventListener("click", bioButtonClick);
backContainer.addEventListener('click', close2DTabs)
scrollBox.addEventListener("mousemove", onMouseMove)
scrollBox.addEventListener("click", backgroundClick);
scrollBox.onscroll = updateScrollValue

function onMouseMove(event){
  const coords = new THREE.Vector2(event.clientX / renderer.domElement.clientWidth * 2 - 1, -(event.clientY / renderer.domElement.clientHeight * 2 - 1));
  raycaster.setFromCamera(coords, camera);
  const intersections = raycaster.intersectObjects(scene.children, true);
  if (intersections.length > 0){
    // const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight
    // distortionMaterial.uniforms.sphereCenter.value = new THREE.Vector3(coords.x * aspect, coords.y, 2.0)
    updateHover3D(intersections[0].object.name);
  }else{
    updateHover3D("")
  }
 }

function updateHover3D(targetName){
  let hoveringSomething = false;
  for (let i = 0; i < projects.length; i++){
    const screen = loadingMesh.getObjectByName(projects[i]);
    screen.material.emissiveIntensity = 0.0;

    if (targetName === projects[i]){
      screen.material.emissiveIntensity = 1.0;
      document.body.style.cursor = "pointer";
      hoveringSomething = true
    }
  }
  
  if (!hoveringSomething){
    document.body.style.cursor = "default";
  }
}

// Dev only
let skipIntro = false;
if (skipIntro){
  camera.position.set(0, 0, -167);
  camera.fov = 50.0;
  camera.updateProjectionMatrix();
  play_clip(animLoaded, mixer, "floating", false);
  torus.visible = false;
  mask.visible = false;
  Windows.visible = true;
  lighthouse.visible = true;
  props.visible = true;

  for(var i=0; i<projectLights.length; i++){
    projectLights[i][0].intensity = projectLights[i][1];
  }

  var elements = document.querySelectorAll('.project-ui');
  for(var i=0; i<elements.length; i++){
    elements[i].style.opacity = "100%";
  }

  pageGrid.material.uniforms.uOpacity = {value : 1.0}
  introDone = true;
  scrollBox.style.overflow = "scroll";
  scrollTarget = 50.0
  scrollPercent = 50.0
  previousScrollPercent = 50.0
  scrollBox.scrollTo(0, 2100.0)
}

function animate() {
  requestAnimationFrame(animate);

  // Updates animations times
  mixer.update(clock.getDelta());
  pageGrid.material.uniforms.uTime = {value : clock.elapsedTime};

  updateScroll();

  triggerEnter();

  updateCamScrollSpeed();
  
  // Render scene
  flatRenderer.render(scene, camera);
  composer.render();
}

animate()

function updateCamScrollSpeed(){
  if (!introDone && !scrollDisabled){return}
  const speedDifference = scrollPercent - previousScrollPercent
  scrollSpeed = THREE.MathUtils.lerp(scrollSpeed, speedDifference, 0.1)

  camera.rotation.set(0, -scrollSpeed*0.1, scrollSpeed*0.1)
  previousScrollPercent = scrollPercent
}

function updateScroll(){
  if (introDone && !scrollDisabled){
    scrollTarget = THREE.MathUtils.lerp(scrollTarget, scrollPercent, 0.1)
    camera.position.set((scrollTarget-50)*0.8, camera.position.y, camera.position.z);
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
  composer.setSize(window.innerWidth, window.innerHeight)
  flatRenderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function backgroundClick(){
  const intersections = raycaster.intersectObjects(scene.children, true);
  raycastClick(intersections[0].object.name)
  
  //Dev Only
  if (skipIntro){
    for(var i=0; i<videosPlayers.length; i++){
      videosPlayers[i].play()
    }
    return;
  }

  // Intro Play
  screenTouched = true
  enterTextLabel.visible = false
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
  if (projectShown === ""){
    scrollDisabled = true
    projectTransition(projectName, 1.0)
    projectShown = projectName
  }else{
    projectTransition(projectShown, 0.0)
    projectShown = ""
  }
}

// Manage projects tranistions animations
let tweenProject
function projectTransition(projectName, val){

  let obj = { value: val === 1.0 ? 0.0 : 1.0 };
  tweenProject = gsap.to(obj, {
    delay: val === 1.0 ? 0.0 : 1.0,
    value: val,
    duration: 1.0,
    ease: "power2.inOut",
    onUpdate: () => {
      distortionMaterial.uniforms.sphereRadius.value = obj.value * 7.5; // 0.5
      distortionMaterial.uniforms.gravityStrength.value = obj.value * 5.0; // 5.0
    },
    onComplete: () => {
      if (val === 1.0){
        camera.position.set(0, 60, -130)
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
  gsap.to(starLinks.material, {
    emissiveIntensity: val * 1.0,
    delay: val === 1.0 ? 1.0 : 0.0,
    duration: 0.7,
    ease: "power2.inOut",
    onComplete: () => {
      if (val === 0.0){
        distortionMaterial.uniforms.sphereRadius.value = 7.5;
        distortionMaterial.uniforms.gravityStrength.value = 5.0;
        camera.position.set((scrollTarget-50)*0.8, 0, -167)
        scrollDisabled = false
      }
    }
  });
}

function open2DTabs(tabName){
  close2DTabs(tabShown);
  
  transition2Dtabs(tabName, 100.0);

  document.querySelector('body').style.overflow = "hidden";
  document.getElementById('bg').style.pointerEvents= "none";

  tabShown = tabName;
  updateHover3D("");
}

function close2DTabs(){
  if (tabShown !== ""){

    transition2Dtabs(tabShown, 0.0);

    document.querySelector('body').style.overflow = "auto";
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
      tab2DContainer.style.opacity = opacityObj.value.toString() + "%";
      backContainer.style.opacity = opacityObj.value.toString() + "%";
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

  backContainer.style.opacity = value.toString() + "%"
  tab2DContainer.style.opacity = value.toString() + "%"
  backContainer.style.visibility = visibility;
  tab2DContainer.style.visibility = visibility;
}

function soundButtonClick(){
  if (volumeMuted){
    ambientSound.setVolume(2.0)
    introSound.setVolume(1.0);
    loadingSound.setVolume(2.0);
    document.getElementById("not-muted-icon").style.visibility = "visible";
    document.getElementById("muted-icon").style.visibility = "hidden";
  }else{
    ambientSound.setVolume(0.0);
    introSound.setVolume(0.0);
    loadingSound.setVolume(0.0);
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
  if (!scrollDisabled){
    scrollPercent = ((scrollBox.scrollTop || scrollBox.scrollTop) / ((scrollBox.scrollHeight || scrollBox.scrollHeight) - document.documentElement.clientHeight)) * 100;
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
            pageGrid.material.uniforms.uOpacity = {value : 0.0}
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
                    
                gsap.to(pageGrid.material.uniforms.uOpacity, {
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
                gsap.to(camera.position, {
                  x: 0,
                  y: 0,
                  z: -167,
                  duration: 5,
                  ease: "power2.inOut",
                  onComplete: () => {
                    lighthouse.visible = true;
                    props.visible = true;

                  }
                });
                gsap.to(camera.rotation, {
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
                    scrollTarget = 50.0
                    scrollPercent = 50.0
                    previousScrollPercent = 50.0
                    scrollBox.scrollTo(0, 2100.0)
                  }
                });
              }
            });
          }
        });
      }
    });
}