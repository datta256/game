/** @satisfies {import('@webcontainer/api').FileSystemTree} */

export const files = {
    'index.html': {
      file: {
        contents: `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="main.jsx"></script>
  </body>
</html>

`,
      },
    },
    'main.jsx': {
      file: {
        contents: `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

`,
      },
    },
    'App.jsx': {
      file: {
        contents: `
import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const Cube = () => {
  const cubeRef = useRef();
  const speed = 0.1;
  const movement = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (movement.current[e.key] !== undefined) {
        movement.current[e.key] = true;
      }
    };
    const handleKeyUp = (e) => {
      if (movement.current[e.key] !== undefined) {
        movement.current[e.key] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (cubeRef.current) {
      if (movement.current.w) cubeRef.current.position.z -= speed;
      if (movement.current.s) cubeRef.current.position.z += speed;
      if (movement.current.a) cubeRef.current.position.x -= speed;
      if (movement.current.d) cubeRef.current.position.x += speed;
    }
  });

  return (
    <mesh ref={cubeRef} position={[0, 1, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
};

const Ground = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 5, 5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Cube />
      <Ground />
      <OrbitControls />
    </Canvas>
  );
}


`,
      },
    },
    'vite.config.js':{
      file: {
        contents: `
       import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

`,
      },
    },
    'package.json': {
      file: {
        contents: `
          {
  "name": "threejs-game",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.121.4",
    "@react-three/fiber": "^8.17.14",
    "@webcontainer/api": "^1.5.1-internal.8",
    "cannon-es": "^0.20.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@react-three/cannon": "^6.6.0",
    "react-hotkeys-hook": "^4.6.1",
    "@react-three/rapier": "^1.5.0",
    "@react-three/postprocessing": "^2.19.1",
    "three": "^0.173.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react": "^7.37.2",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "globals": "^15.14.0",
    "vite": "^6.0.5"
  }
}
`,
      },
    },
  };