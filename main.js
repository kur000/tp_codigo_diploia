let scene, camera, renderer, clock, container, controls;
const images = [];

// NEW: Raycaster setup for clicking objects
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f0f);

    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, .8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    clock = new THREE.Clock();

    await loadPersistentImages();

    window.addEventListener('resize', onWindowResize, false);

    controls = new THREE.PointerLockControls(camera, renderer.domElement);
    // Limita el movimiento vertical de la cámara
    // Math.PI / 2 es mirar exactamente al horizonte. Le sumamos/restamos 0.5 radianes para dar un margen de visión.
    controls.minPolarAngle = Math.PI / 2 - 0.5; // Límite para mirar hacia arriba
    controls.maxPolarAngle = Math.PI / 2 + 0.5; // Límite para mirar hacia abajo
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
    
    // MOUSE DOWN: Only use right-click (button 2) to look around
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            controls.lock();
            e.preventDefault();
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (controls.isLocked) controls.unlock();
    });

    // NEW: Use standard 'click' event strictly for left clicks (button 0)
    renderer.domElement.addEventListener('click', (e) => {
        // e.button === 0 is left click
        if (e.button === 0) {
            // Convert mouse position to normalized device coordinates (-1 to +1)
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(images);

            if (intersects.length > 0) {
                // We hit an image!
                const clickedCube = intersects[0].object;
                openImageOverlay(clickedCube.userData.url);
            }
        }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        if (controls.isLocked) controls.unlock();
    });

    // Drag and Drop
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (controls && controls.isLocked) controls.unlock();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file || !file.type || !file.type.startsWith('image/')) return;

        const previewUrl = URL.createObjectURL(file);
        const cube = addImageCubeFromUrl(previewUrl, true);

        try {
            const fd = new FormData();
            fd.append('image', file);
            const resp = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await resp.json();

            if (data && data.imageUrl) {
                const loader = new THREE.TextureLoader();
                loader.crossOrigin = 'anonymous';
                const newTex = loader.load(data.imageUrl);
                const newTexFlipped = newTex.clone();
                newTexFlipped.wrapS = THREE.RepeatWrapping;
                newTexFlipped.repeat.x = -1;

                cube.material[4].map = newTex;
                cube.material[5].map = newTexFlipped;
                cube.material[4].map.needsUpdate = true;
                cube.material[5].map.needsUpdate = true;
                
                // Update the URL reference for the newly uploaded image
                cube.userData.url = data.imageUrl; 
            }
        } catch (err) {
            console.warn('Upload failed, kept local preview:', err);
        }
    });

    animate();
}

async function loadPersistentImages() {
    try {
        // Fetch from the static JSON file we just generated
        const response = await fetch('./images.json'); 
        if (!response.ok) {
            throw new Error('No se pudo cargar el archivo images.json.');
        }
        const savedImages = await response.json();

        savedImages.forEach(image => {
            addImageCubeFromUrl(image.url, false);
        });

    } catch (error) {
        console.error("Error al cargar imágenes persistentes:", error);
    }
}

function getRandomPosition() {
    const minRadius = 10; 
    const maxRadius = 14; 
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    const theta = Math.random() * Math.PI * 2; 
    const y = (Math.random() - 0.5) * 8; 

    const horizontalRadius = Math.sqrt(radius * radius - y * y);
    const x = horizontalRadius * Math.cos(theta);
    const z = horizontalRadius * Math.sin(theta);

    return { x, y, z };
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    images.forEach((img, index) => {
        img.rotation.y = img.userData.baseRotationY + Math.sin(clock.elapsedTime * 0.5 + index) * 0.05;
        img.position.y += Math.sin(clock.elapsedTime * 0.5 + index) * 0.002;
    });

    if (controls && typeof controls.update === 'function') {
        controls.update(delta);
    }
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

function addImageCubeFromUrl(url, placeInFrontOfCamera = false) {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const texture = loader.load(url);
    const textureFlipped = texture.clone();
    textureFlipped.wrapS = THREE.RepeatWrapping;
    textureFlipped.repeat.x = -1;

    const materials = [
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
        new THREE.MeshStandardMaterial({ map: texture }),
        new THREE.MeshStandardMaterial({ map: textureFlipped })
    ];

    const geometry = new THREE.BoxGeometry(2, 2, 0.001);
    const cube = new THREE.Mesh(geometry, materials);

    if (placeInFrontOfCamera) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const distance = 4;
        const pos = camera.position.clone().add(forward.multiplyScalar(distance));
        cube.position.copy(pos);
        cube.lookAt(camera.position); 
    } else {
        const position = getRandomPosition();
        cube.position.set(position.x, position.y, position.z);
        cube.lookAt(0, 0, 0); 
    }

    // NEW: Save the base rotation AND the image URL into the cube's user data
    cube.userData.baseRotationY = cube.rotation.y;
    cube.userData.url = url; 

    scene.add(cube);
    images.push(cube);
    return cube;
}

// --- OVERLAY LOGIC ---
const overlay = document.getElementById('image-overlay');
const overlayImg = document.getElementById('overlay-img');
const closeBtn = document.getElementById('close-btn');

function openImageOverlay(url) {
    overlayImg.src = url;
    overlay.classList.add('active');
}

function closeImageOverlay() {
    overlay.classList.remove('active');
    // Clear the image source after the fade-out finishes so it doesn't flash the old image next time
    setTimeout(() => { overlayImg.src = ''; }, 300);
}

closeBtn.addEventListener('click', closeImageOverlay);

// Optional: Close overlay if user clicks on the dark background area
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
        closeImageOverlay();
    }
});

// --- INSTRUCTIONS LOGIC ---
const instructionsModal = document.getElementById('instructions-modal');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
    // Fade out
    instructionsModal.style.opacity = '0';
    // Remove from the DOM completely after the transition finishes (0.5s)
    setTimeout(() => {
        instructionsModal.style.display = 'none';
    }, 500);
});