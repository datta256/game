import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { files } from './files';

export default function WebContainerComponent() {
  const iframeRef = useRef(null);
  const textareaRef = useRef(null);
  const [webcontainerInstance, setWebcontainerInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex h-screen w-screen bg-gray-100">
      <div className="w-1/2 p-4 bg-white shadow-lg">
        <textarea
          ref={textareaRef}
          className="w-full h-full p-2 border border-gray-300 rounded-lg resize-none font-mono"
          defaultValue={files['App.jsx'].file.contents}
          onInput={(e) => writeIndexJS(e.currentTarget.value)}
        />
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

