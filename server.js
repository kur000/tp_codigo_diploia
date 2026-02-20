// 1. Importar las librerías
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// 2. Crear la carpeta "images" si no existe
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// 3. Servir archivos estáticos
app.use(express.static(path.join(__dirname)));
app.use('/images', express.static(imagesDir)); // Permite que el frontend lea los archivos de la carpeta images

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (req, res) => res.json({ ok: true }));

// 4. Configurar Multer para guardar en la carpeta local "images"
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'images/')
    },
    filename: function (req, file, cb) {
        // Genera un nombre único para evitar que las imágenes se sobreescriban
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 5. Rutas de la API

// Ruta para subir la imagen localmente
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo.' });
    
    // Devolvemos la URL local
    const imageUrl = `/images/${req.file.filename}`;
    res.status(200).json({ imageUrl: imageUrl, id: req.file.filename });
});

// Ruta para listar las imágenes desde la carpeta local
app.get('/api/images', (req, res) => {
    fs.readdir(imagesDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Error al leer el directorio de imágenes.' });
        
        // Mapeamos los archivos a la estructura que espera tu frontend
        const images = files.map(file => ({
            url: `/images/${file}`,
            id: file
        }));
        
        res.json(images);
    });
});

// 6. Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});