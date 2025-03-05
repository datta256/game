import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { files } from './files';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

export default function WebContainerComponent() {
  const iframeRef = useRef(null);
  const textareaRef = useRef(null);
  const [webcontainerInstance, setWebcontainerInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [modelMetadata, setModelMetadata] = useState([]);

  useEffect(() => {
    if (initialized) return; // Prevent multiple initializations
    setInitialized(true);

    async function setupWebContainer() {
      const instance = await WebContainer.boot();
      setWebcontainerInstance(instance);
      await instance.mount(files);

      const exitCode = await installDependencies(instance);
      if (exitCode !== 0) {
        throw new Error('Installation failed');
      }

      startDevServer(instance);
    }

    setupWebContainer();
  }, [initialized]);

  async function installDependencies(instance) {
    setLoading(true);
    const installProcess = await instance.spawn('npm', ['install']);
    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
        },
      })
    );
    const exitCode = await installProcess.exit;
    setLoading(false);
    return exitCode;
  }

  async function startDevServer(instance) {
    await instance.spawn('npm', ['run', 'dev']);
    instance.on('server-ready', (port, url) => {
      if (iframeRef.current) {
        iframeRef.current.src = `${url}/`;
      }
      console.log(url);
    });
  }

  async function writeIndexJS(content) {
    if (webcontainerInstance) {
      await webcontainerInstance.fs.writeFile('/App.jsx', content);
    }
  }

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const fileContents = {};
      const metadata = [];
      for (const file of files) {
        const sanitizedFileName = sanitizeFileName(file.name);
        const content = await readFile(file);
        fileContents[`/${sanitizedFileName}`] = { file: { contents: new Uint8Array(content) } };
        const modelMetadata = await extractModelMetadata(sanitizedFileName, content);
        metadata.push(modelMetadata);
      }
      await webcontainerInstance.mount(fileContents);
      console.log('Files mounted:', fileContents);
      setModelMetadata(metadata);
      console.log('Model Metadata:', JSON.stringify(metadata, null, 2));
    }
  };

  const sanitizeFileName = (fileName) => {
    return fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  };

  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  const extractModelMetadata = (fileName, content) => {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.parse(content, '', (gltf) => {
        const animations = gltf.animations.map((anim) => ({
          name: anim.name,
          duration: anim.duration,
        }));
        const dimensions = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
        resolve({
          path: `/${fileName}`,
          animations,
          dimensions,
        });
      }, reject);
    });
  };

  const combineModels = (models) => {
    const animations = [];
    models.forEach((model) => {
      animations.push(...model.animations);
    });
    const combinedModel = models[0];
    combinedModel.animations = animations;
    return combinedModel;
  };

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCombinedModel = (model) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      model.scene,
      (result) => {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'combined-model.glb';
        a.click();
        URL.revokeObjectURL(url);
      },
      { binary: true }
    );
  };

  const reloadIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src += '';
    }
  };

  const handleDownloadMetadata = () => {
    console.log('Model Metadata:', JSON.stringify(modelMetadata, null, 2));
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100">
      <div className="w-1/2 p-4 bg-white shadow-lg">
        <textarea
          ref={textareaRef}
          className="w-full h-full p-2 border border-gray-300 rounded-lg resize-none font-mono"
          defaultValue={files['App.jsx'].file.contents}
          onInput={(e) => writeIndexJS(e.currentTarget.value)}
        />
        <input type="file" accept=".glb,.gltf" multiple onChange={handleFileUpload} />
        <button onClick={reloadIframe} className="mt-2 p-2 bg-blue-500 text-white rounded">Reload Frame</button>
        <button onClick={handleDownloadMetadata} className="mt-2 p-2 bg-green-500 text-white rounded">Log Metadata</button>
      </div>
      <div className="w-1/2 p-4 flex justify-center items-center bg-gray-200 shadow-lg">
        {loading ? (
          <div className="text-lg font-semibold text-gray-700">Installing dependencies...</div>
        ) : (
          <iframe
            ref={iframeRef}
            title="WebContainer Output"
            className="w-full h-full border border-gray-400 rounded-lg"
          ></iframe>
        )}
      </div>
    </div>
  );
}

