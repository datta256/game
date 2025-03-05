import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  TransformControls,
  GizmoHelper,
  GizmoViewport,
  useAnimations,
} from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

//
// CodeRunner Component
// ----------------------
// Runs a user-defined update function each frame on the selected object.
// (The code editor and WASD key handling from previous versions remains.)
//
function CodeRunner({ selectedObj, codeFunction, keys }) {
  useFrame((state, delta) => {
    if (selectedObj && codeFunction && selectedObj.model && selectedObj.model.scene) {
      try {
        codeFunction(selectedObj.model.scene, delta, keys);
      } catch (e) {
        console.error('Error in codeFunction:', e);
      }
    }
  });
  return null;
}

//
// SceneObject Component
// -----------------------
// Renders a single object (model). When selected, it’s wrapped in TransformControls
// (using the passed gizmoMode) so you can adjust its transform.
const SceneObject = ({
  objectData,
  isSelected,
  currentAnimation,
  isPlaying,
  additionalAnimations,
  onSelect,
  onUpdate,
  gizmoMode,
}) => {
  const { model } = objectData;
  const group = useRef();

  const mergedAnimations = [
    ...(model.animations || []),
    ...additionalAnimations,
  ];
  const { actions } = useAnimations(mergedAnimations, group);

  useEffect(() => {
    if (actions && currentAnimation) {
      Object.values(actions).forEach((action) => action.stop());
      if (isPlaying && actions[currentAnimation]) {
        actions[currentAnimation].reset().fadeIn(0.5).play();
      } else if (actions[currentAnimation]) {
        actions[currentAnimation].paused = true;
      }
    }
  }, [currentAnimation, actions, isPlaying]);

  const content = (
    <group
      ref={group}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(objectData.id);
      }}
    >
      <primitive object={model.scene} />
    </group>
  );

  return isSelected ? (
    <TransformControls mode={gizmoMode} onObjectChange={() => onUpdate(group.current)}>
      {content}
    </TransformControls>
  ) : (
    content
  );
};

//
// MultiObjectEditor Component
// -----------------------------
// - Loads models from localStorage.
// - Provides collapsible menus including Scene Menu, Uploads, Animation Controls, Object Behaviour,
//   Gizmo Controls, and a Code Editor panel.
// - New Gizmo Controls let you select gizmo mode and lock/unlock the camera.
const MultiObjectEditor = () => {
  const [objects, setObjects] = useState([]); // Each object: { id, name, dataURL, model }
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [additionalAnimations, setAdditionalAnimations] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const loader = new GLTFLoader();

  // Collapsible menus state
  const [menuScene, setMenuScene] = useState(true);
  const [menuUploadModels, setMenuUploadModels] = useState(true);
  const [menuUploadAnimations, setMenuUploadAnimations] = useState(true);
  const [menuAnimationControls, setMenuAnimationControls] = useState(true);
  const [menuObjectBehaviour, setMenuObjectBehaviour] = useState(true);
  const [menuCodeEditor, setMenuCodeEditor] = useState(true);
  const [menuGizmoControls, setMenuGizmoControls] = useState(true);

  // New state for gizmo mode and camera lock.
  const [gizmoMode, setGizmoMode] = useState('translate'); // "translate", "rotate", "scale"
  const [cameraLocked, setCameraLocked] = useState(false);

  // Code editor state (WASD movement by default)
  const defaultCode = `// Basic WASD movement update function
// object: the selected object's scene
// delta: time delta in seconds
// keys: {w, a, s, d} booleans
function update(object, delta, keys) {
  const speed = 2;
  if (keys.w) object.position.z -= speed * delta;
  if (keys.s) object.position.z += speed * delta;
  if (keys.a) object.position.x -= speed * delta;
  if (keys.d) object.position.x += speed * delta;
}
update;`;
  const [code, setCode] = useState(defaultCode);
  const [codeFunction, setCodeFunction] = useState(null);

  // WASD key state
  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false });
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys((prev) => ({ ...prev, [key]: true }));
      }
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys((prev) => ({ ...prev, [key]: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // On mount, load models from localStorage.
  useEffect(() => {
    const storedModels = JSON.parse(localStorage.getItem('uploadedModels') || '[]');
    storedModels.forEach((stored) => {
      loader.load(stored.dataURL, (loadedGltf) => {
        const newObj = {
          id: stored.id,
          name: stored.name,
          dataURL: stored.dataURL,
          model: loadedGltf,
        };
        setObjects((prev) => [...prev, newObj]);
        if (!selectedObjectId) {
          setSelectedObjectId(newObj.id);
          if (loadedGltf.animations && loadedGltf.animations.length > 0) {
            setCurrentAnimation(loadedGltf.animations[0].name || `${stored.name} - 1`);
          }
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle model upload.
  const handleModelUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataURL = e.target.result;
        loader.load(dataURL, (loadedGltf) => {
          const newObj = { id: Date.now(), name: file.name, dataURL, model: loadedGltf };
          setObjects((prev) => [...prev, newObj]);
          const storedModels = JSON.parse(localStorage.getItem('uploadedModels') || '[]');
          storedModels.push({ id: newObj.id, name: newObj.name, dataURL });
          localStorage.setItem('uploadedModels', JSON.stringify(storedModels));
          if (!selectedObjectId) {
            setSelectedObjectId(newObj.id);
            if (loadedGltf.animations && loadedGltf.animations.length > 0) {
              setCurrentAnimation(loadedGltf.animations[0].name || `${file.name} - 1`);
            }
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle folder upload for animations.
  const handleFolderUpload = async (event) => {
    const files = event.target.files;
    const promises = Array.from(files).map((file) => {
      const fileName = file.name;
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        loader.load(
          url,
          (loadedGltf) => {
            if (loadedGltf.animations && loadedGltf.animations.length > 0) {
              loadedGltf.animations.forEach((clip, index) => {
                if (!clip.name || clip.name.trim() === '' || clip.name === 'Animation 1') {
                  clip.name = `${fileName} - ${index + 1}`;
                }
              });
              resolve(loadedGltf.animations);
            } else {
              resolve([]);
            }
          },
          undefined,
          (error) => {
            console.error('Error loading file:', fileName, error);
            resolve([]);
          }
        );
      });
    });
    const results = await Promise.all(promises);
    const allAnimations = results.flat();
    console.log('All uploaded animations:', allAnimations);
    setAdditionalAnimations((prev) => [...prev, ...allAnimations]);
    if (!currentAnimation && allAnimations.length > 0) {
      setCurrentAnimation(allAnimations[0].name);
    }
  };

  const handleTransformUpdate = (obj) => {
    console.log(
      'Updated transform:',
      obj.position.toArray(),
      obj.rotation.toArray(),
      obj.scale.toArray()
    );
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Compute merged animations for the selected object.
  const getMergedAnimationsForSelected = () => {
    const selectedObj = objects.find((obj) => obj.id === selectedObjectId);
    if (!selectedObj) return [];
    const merged = [
      ...(selectedObj.model.animations || []),
      ...additionalAnimations,
    ];
    const nameCounts = {};
    merged.forEach((clip) => {
      let name = clip.name || 'Animation';
      if (nameCounts[name]) {
        nameCounts[name]++;
        clip.name = `${name} (${nameCounts[name]})`;
      } else {
        nameCounts[name] = 1;
        clip.name = name;
      }
    });
    return merged;
  };

  const mergedAnimationsForSelected = getMergedAnimationsForSelected();

  // Update properties for the selected object.
  const updateSelectedObjectProperty = (prop, value) => {
    setObjects((prev) =>
      prev.map((obj) => {
        if (obj.id === selectedObjectId) {
          if (prop === 'name') {
            obj.name = value;
          }
          if (prop === 'visible') {
            obj.model.scene.visible = value;
          }
          if (prop === 'castShadow') {
            obj.model.scene.castShadow = value;
          }
          if (prop === 'receiveShadow') {
            obj.model.scene.receiveShadow = value;
          }
          if (prop === 'userData') {
            try {
              obj.model.scene.userData = JSON.parse(value);
            } catch (e) {
              console.error('Invalid JSON for userData:', e);
            }
          }
          return { ...obj };
        }
        return obj;
      })
    );
  };

  const selectedObj = objects.find((obj) => obj.id === selectedObjectId);

  // Code Editor "Run Code" handler.
  const runCode = () => {
    try {
      // Evaluate the code to get a function.
      // eslint-disable-next-line no-eval
      const fn = eval(code);
      if (typeof fn === 'function') {
        setCodeFunction(() => fn);
      } else {
        console.error('The evaluated code did not return a function.');
      }
    } catch (e) {
      console.error('Error evaluating code:', e);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '250px',
          padding: '1rem',
          borderRight: '1px solid #ccc',
          background: '#eee',
          overflowY: 'auto',
        }}
      >
        <h3>Multi-Object Editor</h3>
        {/* Scene Menu */}
        <div>
          <h4 onClick={() => setMenuScene(!menuScene)} style={{ cursor: 'pointer' }}>
            {menuScene ? '▼' : '►'} Scene Menu
          </h4>
          {menuScene && (
            <ul style={{ listStyle: 'none', paddingLeft: '1rem' }}>
              {objects.map((obj) => (
                <li
                  key={obj.id}
                  style={{
                    cursor: 'pointer',
                    padding: '0.25rem',
                    background: obj.id === selectedObjectId ? '#ddd' : 'transparent',
                  }}
                  onClick={() => setSelectedObjectId(obj.id)}
                >
                  {obj.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upload Model */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuUploadModels(!menuUploadModels)} style={{ cursor: 'pointer' }}>
            {menuUploadModels ? '▼' : '►'} Upload Model
          </h4>
          {menuUploadModels && (
            <input type="file" onChange={handleModelUpload} accept=".gltf,.glb" />
          )}
        </div>

        {/* Upload Animation Folder */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuUploadAnimations(!menuUploadAnimations)} style={{ cursor: 'pointer' }}>
            {menuUploadAnimations ? '▼' : '►'} Upload Animation Folder
          </h4>
          {menuUploadAnimations && (
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderUpload}
              accept=".gltf,.glb"
            />
          )}
        </div>

        {/* Animation Controls */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuAnimationControls(!menuAnimationControls)} style={{ cursor: 'pointer' }}>
            {menuAnimationControls ? '▼' : '►'} Animation Controls
          </h4>
          {menuAnimationControls && (
            <>
              <select value={currentAnimation} onChange={(e) => setCurrentAnimation(e.target.value)}>
                {mergedAnimationsForSelected.map((clip) => (
                  <option key={clip.uuid} value={clip.name}>
                    {clip.name}
                  </option>
                ))}
              </select>
              <button onClick={togglePlayPause} style={{ padding: '0.5rem', marginTop: '0.5rem' }}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </>
          )}
        </div>

        {/* Object Behaviour */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuObjectBehaviour(!menuObjectBehaviour)} style={{ cursor: 'pointer' }}>
            {menuObjectBehaviour ? '▼' : '►'} Object Behaviour
          </h4>
          {menuObjectBehaviour && selectedObj && (
            <div style={{ paddingLeft: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Name:</label>
                <input
                  type="text"
                  value={selectedObj.name}
                  onChange={(e) => updateSelectedObjectProperty('name', e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Visible:</label>
                <input
                  type="checkbox"
                  checked={selectedObj.model.scene.visible}
                  onChange={(e) => updateSelectedObjectProperty('visible', e.target.checked)}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Cast Shadow:</label>
                <input
                  type="checkbox"
                  checked={selectedObj.model.scene.castShadow}
                  onChange={(e) => updateSelectedObjectProperty('castShadow', e.target.checked)}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Receive Shadow:</label>
                <input
                  type="checkbox"
                  checked={selectedObj.model.scene.receiveShadow}
                  onChange={(e) => updateSelectedObjectProperty('receiveShadow', e.target.checked)}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>User Data:</label>
                <textarea
                  rows="3"
                  style={{ width: '100%' }}
                  value={JSON.stringify(selectedObj.model.scene.userData, null, 2)}
                  onChange={(e) => updateSelectedObjectProperty('userData', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Gizmo Controls */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuGizmoControls(!menuGizmoControls)} style={{ cursor: 'pointer' }}>
            {menuGizmoControls ? '▼' : '►'} Gizmo Controls
          </h4>
          {menuGizmoControls && (
            <div style={{ paddingLeft: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Mode:</label>
                <select value={gizmoMode} onChange={(e) => setGizmoMode(e.target.value)}>
                  <option value="translate">Translate</option>
                  <option value="rotate">Rotate</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <button onClick={() => setCameraLocked((prev) => !prev)} style={{ padding: '0.5rem' }}>
                  {cameraLocked ? 'Unlock Camera' : 'Lock Camera'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Code Editor */}
        <div style={{ marginTop: '1rem' }}>
          <h4 onClick={() => setMenuCodeEditor(!menuCodeEditor)} style={{ cursor: 'pointer' }}>
            {menuCodeEditor ? '▼' : '►'} Code Editor
          </h4>
          {menuCodeEditor && (
            <div style={{ paddingLeft: '1rem' }}>
              <textarea
                rows="8"
                style={{ width: '100%' }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button onClick={runCode} style={{ padding: '0.5rem', marginTop: '0.5rem' }}>
                Run Code
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button
            onClick={() => {
              console.log('Objects:', objects);
              console.log('Additional Animations:', additionalAnimations);
            }}
            style={{ padding: '0.5rem' }}
          >
            Log All
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [0, 2, 5] }} style={{ background: '#333' }}>
          <ambientLight intensity={0.5} />
          {/* Disable OrbitControls when cameraLocked is true */}
          <OrbitControls enabled={!cameraLocked} />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="white" />
          </GizmoHelper>
          {objects.map((obj) => (
            <SceneObject
              key={obj.id}
              objectData={obj}
              isSelected={obj.id === selectedObjectId}
              currentAnimation={currentAnimation}
              isPlaying={isPlaying}
              additionalAnimations={additionalAnimations}
              onSelect={(id) => setSelectedObjectId(id)}
              onUpdate={handleTransformUpdate}
              gizmoMode={gizmoMode}
            />
          ))}
          <CodeRunner
            selectedObj={objects.find((obj) => obj.id === selectedObjectId)}
            codeFunction={codeFunction}
            keys={keys}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default MultiObjectEditor;
