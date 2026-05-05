# Tasks

## mediapipe-3d-gesture-interaction

- [x] 1. Remove legacy dependencies and scaffold new HTML structure
  - [x] 1.1 Delete the `<script>` tags for `@tensorflow/tfjs` and `@teachablemachine/pose` from the `<head>`
  - [x] 1.2 Delete the `<script type="module">` block that imports from `@splinetool/runtime`
  - [x] 1.3 Add an `<script type="importmap">` block mapping `"three"` to `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
  - [x] 1.4 Add a `<script>` tag loading MediaPipe Hands from `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424926/hands.js`
  - [x] 1.5 Verify the HTML no longer contains any reference to `tmPose`, `tmModel`, `splineApp`, `splineCamera`, `MODE_SEQUENCE`, `MODE_SCROLL_LISTS`, `triggerKey`, or `triggerSafeSequence`
  - [x] 1.6 Retain the existing DOM structure: `#loader-overlay`, `#video-overlay`, `#videoFeed`, `#outputCanvas`, `#camera-msg`, `#hud-layer`, `#canvas3d`, `#processingCanvas`, `#mobile-notice`
  - [x] 1.7 Set `#loader-overlay` to `display: none` in CSS so it is hidden throughout the page lifecycle

- [x] 2. Implement the `CONFIG` object and shared `state` object
  - [x] 2.1 Create the `CONFIG` object at the top of the new `<script type="module">` block with all tunable parameters: `FACE_CASCADE_URL`, `FACE_FPS` (20), `HANDS_FPS` (30), `DRAW_FPS` (60), `PINCH_THRESHOLD` (0.08), `GESTURE_DEBOUNCE_FRAMES` (3), `CAMERA_LERP` (0.08), `CAMERA_X_SENSITIVITY` (80), `CAMERA_Y_SENSITIVITY` (60), `FACE_LOST_TIMEOUT_MS` (500), `DEPTH_MIN` (-300), `DEPTH_MAX` (300), `HAND_SIZE_MIN` (0.10), `HAND_SIZE_MAX` (0.40), `DEPTH_LERP` (0.10), `ROTATE_SENSITIVITY` (5.0), `TWO_HAND_SENSITIVITY` (3.0)
  - [x] 2.2 Create the `state` object with readiness flags (`cameraReady`, `threeReady`, `handsReady`, `cvReady`), face detection fields (`currentFaceRect`, `lastFaceDetectedTime`), `cameraTarget` (`{ normX: 0, normY: 0 }`), `gestureState` (left/right per-hand objects with `gesture`, `pinchPoint`, `indexTip`, `bbox`; plus `twoHandPinch`), `interaction` object (`mode: 'idle'`, `targetObject`, `grabOffset`, `prevPinchMidpoint`, `prevTwoHandVec`, `prevIndexPos`), and `debounce` buffers for left and right hands

- [x] 3. Implement `initWebcam()`
  - [x] 3.1 Request `getUserMedia` with `{ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }`
  - [x] 3.2 On success: set `outputCanvas.width/height` to match the video stream dimensions, set `state.cameraReady = true`, show `#video-overlay` by adding the `visible` class, and hide `#camera-msg`
  - [x] 3.3 On error: set the `error` CSS class on `#camera-msg` and display an appropriate error message; do not set `state.cameraReady`
  - [x] 3.4 Start the `mainLoop` via `requestAnimationFrame` immediately after `state.cameraReady` is set (do not wait for Three.js or MediaPipe)

- [x] 4. Implement `initThreeScene()`
  - [x] 4.1 Create a `THREE.WebGLRenderer` attached to `#canvas3d` with `antialias: true`; set its pixel ratio and initial size to `window.innerWidth × window.innerHeight`
  - [x] 4.2 Create a `THREE.PerspectiveCamera` with FOV 60, near 1, far 2000, positioned at `(0, 0, 600)` looking at the origin; store as `window.threeCamera`
  - [x] 4.3 Create a `THREE.Scene`; store as `window.threeScene`
  - [x] 4.4 Add a `THREE.AmbientLight` (intensity 0.8) and a `THREE.DirectionalLight` at position `(200, 400, 300)` (intensity 1.2) to the scene
  - [x] 4.5 Build the room: add six `THREE.PlaneGeometry` meshes (floor, ceiling, back wall, left wall, right wall, front wall) with `MeshStandardMaterial` in off-white/cream tones, sized and positioned to form an enclosed room around the origin
  - [x] 4.6 Create the interactive cube: `THREE.BoxGeometry(80, 80, 80)` with `MeshStandardMaterial({ color: 0x4a90d9 })`, centred at origin; store as `window.interactiveCube` and add to scene
  - [x] 4.7 Add a `window.addEventListener('resize', ...)` handler that calls `renderer.setSize(window.innerWidth, window.innerHeight)` and updates `threeCamera.aspect` and `threeCamera.updateProjectionMatrix()`
  - [x] 4.8 Set `state.threeReady = true` after scene setup is complete

- [x] 5. Implement `initOpenCv()`
  - [x] 5.1 Wait for the `opencv-ready` event (or `window.appState.cvLoaded` already true) before proceeding
  - [x] 5.2 Poll until `window.cv && window.cv.CascadeClassifier` is available
  - [x] 5.3 Fetch `CONFIG.FACE_CASCADE_URL`, write the XML bytes to the OpenCV virtual filesystem, and load the classifier; wrap in try/catch so failures are silent
  - [x] 5.4 Set `state.cvReady = true` after the classifier is loaded (or after the fetch fails, so the app continues without face detection)

- [x] 6. Implement `initMediaPipeHands()`
  - [x] 6.1 Instantiate `new Hands({ locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424926/\${file}\` })`
  - [x] 6.2 Call `hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 })`
  - [x] 6.3 Register `hands.onResults(onHandResults)` where `onHandResults` calls `classifyGestures(results)` then `drawHandSkeleton(results)`
  - [x] 6.4 Store the `hands` instance in a module-level variable; set `state.handsReady = true`

- [x] 7. Implement `classifyGestures(results)` — the Gesture_Classifier
  - [x] 7.1 Extract `multiHandLandmarks` and `multiHandedness` from `results`; map each hand to its `left`/`right` label (note: MediaPipe labels are from the camera's perspective, so flip left/right for mirror display)
  - [x] 7.2 Implement `classifyGesture(landmarks)`: return `'pinch'` if `dist(lm[4], lm[8]) < CONFIG.PINCH_THRESHOLD`; return `'point'` if index is extended and middle/ring/pinky are curled; return `'open_hand'` if all four fingers are extended; otherwise return `'none'`. Use `tip.y < MCP.y` for extended and `tip.y > MCP.y` for curled (normalised coords)
  - [x] 7.3 Implement the debounce buffer: for each hand, if the new raw gesture matches `debounce[hand].candidate`, increment `debounce[hand].count`; if count reaches `CONFIG.GESTURE_DEBOUNCE_FRAMES`, commit the gesture to `state.gestureState[hand].gesture`; if the new raw gesture differs from the candidate, reset candidate and count to the new gesture and 1
  - [x] 7.4 When a hand's committed gesture is `'pinch'`, compute `pinchPoint` as the midpoint of `lm[4]` and `lm[8]` in normalised coords and store in `state.gestureState[hand].pinchPoint`
  - [x] 7.5 When a hand's committed gesture is `'point'`, store `lm[8]` as `state.gestureState[hand].indexTip`
  - [x] 7.6 Always compute the bounding box over all 21 landmarks and store in `state.gestureState[hand].bbox`
  - [x] 7.7 After processing both hands, set `state.gestureState.twoHandPinch = (left.gesture === 'pinch' && right.gesture === 'pinch')`
  - [x] 7.8 When `results.multiHandLandmarks` is empty or a hand is absent, reset that hand's gesture state to `{ gesture: 'none', pinchPoint: null, indexTip: null, bbox: null }` and reset its debounce buffer

- [x] 8. Implement `drawHandSkeleton(results)`
  - [x] 8.1 If `results.multiHandLandmarks` is empty or null, return without calling `clearRect` on the full canvas (to preserve the face bounding box)
  - [x] 8.2 For each detected hand, iterate over the MediaPipe `HAND_CONNECTIONS` array and draw each connection as a line on `outputCtx` using white stroke
  - [x] 8.3 For each detected hand, draw each of the 21 landmarks as a filled circle (radius 3 px) using `#F67D3E` fill; scale normalised coords to `outputCanvas.width/height`
  - [x] 8.4 Do not call `outputCtx.clearRect` anywhere in this function — the webcam frame draw in `mainLoop` handles canvas clearing each frame

- [x] 9. Implement `detectFace()` — OpenCV face detection
  - [x] 9.1 Guard: if `!state.cvReady || !classifier || classifier.empty()`, return immediately
  - [x] 9.2 Draw the current video frame to `processingCanvas` (160×120), run `cv.cvtColor` to grayscale, run `classifier.detectMultiScale`, find the largest face rect
  - [x] 9.3 Scale the detected rect from processing canvas coords to output canvas coords using `PARAMS.scaleFactor`; store in `state.currentFaceRect` and update `state.lastFaceDetectedTime`
  - [x] 9.4 Update `state.cameraTarget.normX` and `state.cameraTarget.normY` from the face centre position normalised to `[−1, 1]`
  - [x] 9.5 If no face is detected and `Date.now() - state.lastFaceDetectedTime > CONFIG.FACE_LOST_TIMEOUT_MS`, reset `state.cameraTarget` to `{ normX: 0, normY: 0 }` and clear `state.currentFaceRect`
  - [x] 9.6 Wrap all OpenCV mat operations in try/catch and call `.delete()` on all mats in a finally block to prevent memory leaks

- [x] 10. Implement `updateCamera()` — Camera_Controller
  - [x] 10.1 If `!state.threeReady`, return immediately
  - [x] 10.2 Compute `targetX = -state.cameraTarget.normX * CONFIG.CAMERA_X_SENSITIVITY` and `targetY = -state.cameraTarget.normY * CONFIG.CAMERA_Y_SENSITIVITY`
  - [x] 10.3 Lerp `threeCamera.position.x` toward `targetX` and `threeCamera.position.y` toward `targetY` using `CONFIG.CAMERA_LERP`; keep `threeCamera.position.z` fixed at 600
  - [x] 10.4 Call `threeCamera.lookAt(0, 0, 0)` after updating position

- [x] 11. Implement `updateInteraction()` — Interaction_Manager
  - [x] 11.1 Implement `raycastFromNormalisedPoint(normX, normY)`: convert normalised video coords to NDC (`x * 2 - 1`, `-(y * 2 - 1)`), call `raycaster.setFromCamera(ndc, threeCamera)`, return `raycaster.intersectObject(interactiveCube)`
  - [x] 11.2 Implement the `idle → grabbed` transition: when `state.gestureState.twoHandPinch` is false and a single hand has `gesture === 'pinch'`, call `raycastFromNormalisedPoint` with the pinch point; if there is a hit, set `interaction.mode = 'grabbed'`, store `interaction.targetObject`, compute and store `interaction.grabOffset` as the difference between the cube's world position and the hit point
  - [x] 11.3 Implement the `grabbed` state each frame: project the current pinch point to world XY (using a plane at the cube's current Z), apply `grabOffset`, update `cube.position.x` and `cube.position.y`; compute depth from `state.gestureState[hand].bbox` width, map to target Z using the formula in the design, lerp `cube.position.z` toward target Z, clamp to `[CONFIG.DEPTH_MIN, CONFIG.DEPTH_MAX]`
  - [x] 11.4 Implement the `grabbed → idle` transition: when the grabbing hand emits `open_hand` or the hand is lost, set `interaction.mode = 'idle'` and clear `interaction.targetObject` and `interaction.grabOffset`
  - [x] 11.5 Implement the `idle → pointed` transition: when a hand has `gesture === 'point'`, call `raycastFromNormalisedPoint` with the index tip; if there is a hit, set `interaction.mode = 'pointed'` and store `interaction.prevIndexPos`
  - [x] 11.6 Implement the `pointed` state each frame: compute `velocityX = currentIndexTip.x - interaction.prevIndexPos.x`; apply `cube.rotation.y += velocityX * CONFIG.ROTATE_SENSITIVITY`; update `interaction.prevIndexPos`
  - [x] 11.7 Implement the `pointed → idle` transition: when the pointing hand no longer emits `point` or is lost, set `interaction.mode = 'idle'`
  - [x] 11.8 Implement the `idle → two_hand_rotate` transition: when `state.gestureState.twoHandPinch` is true, set `interaction.mode = 'two_hand_rotate'`; store the initial vector between the two pinch points as `interaction.prevTwoHandVec`
  - [x] 11.9 Implement the `two_hand_rotate` state each frame: compute the current vector between left and right pinch points; compute `deltaX = currentVec.x - prevVec.x` and `deltaY = currentVec.y - prevVec.y`; apply `cube.rotation.y += deltaX * CONFIG.TWO_HAND_SENSITIVITY` and `cube.rotation.x += deltaY * CONFIG.TWO_HAND_SENSITIVITY`; update `interaction.prevTwoHandVec`
  - [x] 11.10 Implement the `two_hand_rotate → idle` transition: when either hand's gesture is no longer `'pinch'`, set `interaction.mode = 'idle'`
  - [x] 11.11 Apply visual feedback: set `cube.material.emissive` to `0x224488` when `grabbed`, `0x442200` when `pointed`, and `0x000000` when `idle` or `two_hand_rotate`

- [x] 12. Implement `mainLoop(timestamp)`
  - [x] 12.1 If `state.cameraReady`: draw the current video frame to `outputCanvas` via `outputCtx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height)`; if `state.currentFaceRect` is set, draw the orange bounding rectangle using `#F67D3E` stroke
  - [x] 12.2 If `state.threeReady`: call `updateCamera()`, call `updateInteraction()`, call `threeRenderer.render(threeScene, threeCamera)`
  - [x] 12.3 Throttle face detection: if `timestamp - lastFaceTime > 1000 / CONFIG.FACE_FPS`, call `detectFace()` and update `lastFaceTime`
  - [x] 12.4 Throttle hand detection: if `state.handsReady` and `timestamp - lastHandsTime > 1000 / CONFIG.HANDS_FPS`, call `hands.send({ image: video })` wrapped in try/catch, and update `lastHandsTime`
  - [x] 12.5 Call `requestAnimationFrame(mainLoop)` at the end of every frame

- [x] 13. Implement `startAppFlow()` and mobile guard
  - [x] 13.1 Check `window.innerWidth > 768`; if not, show `#mobile-notice` and return without initialising anything
  - [x] 13.2 Call `initWebcam()` first and await it; then fire `initThreeScene()`, `initMediaPipeHands()`, and `initOpenCv()` concurrently (do not await them before starting the main loop)
  - [x] 13.3 Call `startAppFlow()` at the bottom of the script (equivalent to the existing pattern)

- [x] 14. Write property-based tests for pure gesture and depth functions
  - [x] 14.1 Extract `classifyGesture`, `applyDebounce`, `computeTargetZ`, and `classifyPinch` as pure, exportable functions (or test them via a test harness that imports the module)
  - [x] 14.2 Write a property test for Property 1 (pinch ↔ distance < threshold): generate random pairs of `{ x, y }` points in `[0,1]`; assert `classifyPinch(a, b) === (euclideanDist(a, b) < CONFIG.PINCH_THRESHOLD)` — tag: `Feature: mediapipe-3d-gesture-interaction, Property 1`
  - [x] 14.3 Write a property test for Property 2 (debounce): generate random sequences of gesture labels; assert the committed gesture only changes after 3 consecutive matching frames — tag: `Feature: mediapipe-3d-gesture-interaction, Property 2`
  - [x] 14.4 Write a property test for Property 3 (monotonic depth): generate random pairs `w1 < w2` in `[HAND_SIZE_MIN, HAND_SIZE_MAX]`; assert `computeTargetZ(w1) > computeTargetZ(w2)` — tag: `Feature: mediapipe-3d-gesture-interaction, Property 3`
  - [x] 14.5 Write a property test for Property 4 (Z clamping): generate random depth estimates; assert the clamped Z is always in `[CONFIG.DEPTH_MIN, CONFIG.DEPTH_MAX]` — tag: `Feature: mediapipe-3d-gesture-interaction, Property 4`
  - [x] 14.6 Write a property test for Property 6 (single gesture per frame): generate random 21-landmark arrays; assert `classifyGesture` returns exactly one value from `{ 'none', 'pinch', 'point', 'open_hand' }` — tag: `Feature: mediapipe-3d-gesture-interaction, Property 6`
  - [x] 14.7 Write a property test for Property 7 (two-hand pinch invariant): generate random combinations of left/right gesture labels; assert `twoHandPinch === (left === 'pinch' && right === 'pinch')` — tag: `Feature: mediapipe-3d-gesture-interaction, Property 7`
  - [x] 14.8 Configure each property test to run a minimum of 100 iterations using fast-check's `numRuns` option

- [x] 15. Verify legacy removal and run smoke checks
  - [x] 15.1 Search the final HTML source for `tmPose`, `@teachablemachine`, `@tensorflow`, `splineApp`, `splineCamera`, `triggerKey`, `triggerSafeSequence`, `MODE_SEQUENCE`, `MODE_SCROLL_LISTS`; assert none are present
  - [x] 15.2 Verify `#loader-overlay` has `display: none` or equivalent in the CSS so it is never visible
  - [x] 15.3 Open the file in a browser (or headless Playwright), grant a mock webcam, and verify `#video-overlay` becomes visible and `#canvas3d` renders without console errors
