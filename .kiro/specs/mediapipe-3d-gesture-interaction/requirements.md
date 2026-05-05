# Requirements Document

## Introduction

This feature replaces the existing Teachable Machine Pose + Spline 3D scene stack in `test-opt.html` with a new stack built on MediaPipe Hands and Three.js. The result is a gesture-driven, immersive 3D room experience where:

- **MediaPipe Hands** detects 21-keypoint hand landmarks from the webcam feed and classifies gestures (pinch, point, open hand, two-hand).
- **Three.js** renders a bright interior room scene containing interactive 3D objects (starting with a cube) that the user can grab, drag, rotate, and push/pull using hand gestures.
- **OpenCV face detection** (Haar cascade) is retained and now drives the Three.js camera, creating a parallax/head-tracking immersiveness effect.
- The existing Teachable Machine Pose system and Spline scene are fully removed.
- The app starts as soon as the webcam is ready; Three.js and MediaPipe load progressively in the background.
- The mobile notice, webcam overlay, and Lottie loader overlay structure are preserved (loader is hidden/disabled for now).

---

## Glossary

- **App**: The single-page web application in `test-opt.html`.
- **MediaPipe_Hands**: The MediaPipe Hands solution that detects up to 2 hands and returns 21 3D landmarks per hand.
- **Gesture_Classifier**: The module that interprets MediaPipe_Hands landmark data and emits named gesture events.
- **Three_Scene**: The Three.js WebGL scene that renders the room environment and interactive objects.
- **Camera_Controller**: The module that reads OpenCV face detection output and applies parallax offsets to the Three_Scene camera.
- **Interaction_Manager**: The module that maps Gesture_Classifier events to Three_Scene object manipulation (pick, drag, rotate, depth-push).
- **Webcam_Overlay**: The fixed 160×120 px video overlay in the top-right corner that displays the mirrored webcam feed with drawn overlays.
- **Hand_Skeleton_Overlay**: The canvas layer drawn on top of the Webcam_Overlay that renders MediaPipe hand landmarks and connections.
- **Pinch_Gesture**: Both thumb tip and index finger tip are within a threshold distance — used for grab/drag.
- **Point_Gesture**: Index finger extended, all other fingers curled — used for highlight/rotate.
- **Open_Hand_Gesture**: All five fingers extended — used for release/reset.
- **Two_Hand_Gesture**: Both hands simultaneously detected with a Pinch_Gesture on each — used for two-hand rotation.
- **Depth_Estimate**: A scalar value derived from the apparent size of the detected hand (or pinch distance) that maps to a Z-axis offset for the grabbed object.
- **Room_Scene**: The Three.js environment representing a bright interior room.
- **Interactive_Object**: A Three.js mesh within the Room_Scene that can be selected and manipulated. Initially a single cube.
- **Loader_Overlay**: The existing full-screen white overlay with Lottie animation — retained in DOM but hidden/disabled.
- **Mobile_Notice**: The existing full-screen overlay shown on viewports ≤ 768 px wide.

---

## Requirements

### Requirement 1: System Initialisation and Progressive Loading

**User Story:** As a visitor, I want the page to become interactive as quickly as possible, so that I am not blocked by a long loading screen.

#### Acceptance Criteria

1. WHEN the page loads on a viewport wider than 768 px, THE App SHALL request webcam access immediately without waiting for Three.js or MediaPipe to finish loading.
2. WHEN webcam access is granted, THE App SHALL display the Webcam_Overlay and begin rendering the webcam feed within 500 ms.
3. WHEN Three_Scene assets finish loading, THE App SHALL begin rendering the Room_Scene on the main canvas without requiring a page reload.
4. WHEN MediaPipe_Hands finishes loading, THE App SHALL begin processing webcam frames for gesture detection without requiring a page reload.
5. IF webcam access is denied, THEN THE App SHALL display an error message inside the Webcam_Overlay camera message area.
6. THE Loader_Overlay SHALL remain hidden (display: none or opacity: 0, pointer-events: none) throughout the page lifecycle.
7. THE Mobile_Notice SHALL be displayed on viewports with a width of 768 px or less, and THE App SHALL not initialise any detection or rendering systems on those viewports.

---

### Requirement 2: Three.js Room Scene Rendering

**User Story:** As a visitor, I want to see a bright, immersive 3D room environment, so that the experience feels engaging and spatial.

#### Acceptance Criteria

1. THE Three_Scene SHALL render a Room_Scene that uses a bright interior aesthetic (light-coloured walls, floor, and ceiling) visible on the full-screen main canvas.
2. THE Three_Scene SHALL contain at least one Interactive_Object (a cube mesh) positioned in the centre of the Room_Scene at scene initialisation.
3. THE Three_Scene SHALL use ambient and directional lighting sufficient to make the Room_Scene and Interactive_Object clearly visible without requiring gesture interaction.
4. WHEN the browser window is resized, THE Three_Scene SHALL update its renderer size and camera aspect ratio to fill the viewport without distortion.
5. THE Three_Scene SHALL render at a target of 60 frames per second on a modern desktop browser.

---

### Requirement 3: OpenCV Face Detection and Camera Parallax

**User Story:** As a visitor, I want the 3D room to subtly shift as I move my head, so that the scene feels physically immersive.

#### Acceptance Criteria

1. WHEN a face is detected by the OpenCV Haar cascade classifier, THE Camera_Controller SHALL update the Three_Scene camera position to apply a parallax offset proportional to the normalised horizontal and vertical position of the face centre within the video frame.
2. THE Camera_Controller SHALL apply the parallax offset using linear interpolation (lerp) each render frame so that camera movement is smooth and continuous.
3. WHEN no face is detected for more than 500 ms, THE Camera_Controller SHALL lerp the Three_Scene camera back toward its neutral position.
4. THE Camera_Controller SHALL run face detection at a maximum of 20 frames per second to limit CPU usage.
5. THE Camera_Controller SHALL draw a bounding rectangle around the detected face on the Webcam_Overlay output canvas using the existing orange accent colour (`#F67D3E`).

---

### Requirement 4: MediaPipe Hands Detection

**User Story:** As a visitor, I want my hand movements to be tracked in real time, so that I can interact with the 3D scene using gestures.

#### Acceptance Criteria

1. WHEN MediaPipe_Hands is initialised, THE MediaPipe_Hands SHALL process webcam frames at a maximum of 30 frames per second.
2. THE MediaPipe_Hands SHALL detect up to 2 hands simultaneously and provide 21 3D landmarks per detected hand.
3. WHEN at least one hand is detected, THE Hand_Skeleton_Overlay SHALL draw the hand landmarks and connections on the Webcam_Overlay canvas in real time.
4. WHEN no hands are detected for more than 100 ms, THE Hand_Skeleton_Overlay SHALL clear the previously drawn skeleton from the Webcam_Overlay canvas.
5. THE MediaPipe_Hands SHALL operate on the same webcam video element used by the face detection system without requiring a second camera stream.

---

### Requirement 5: Gesture Classification

**User Story:** As a visitor, I want the system to recognise specific hand shapes, so that I can trigger distinct interactions in the 3D scene.

#### Acceptance Criteria

1. WHEN the distance between the thumb tip landmark and the index finger tip landmark of a detected hand is less than a configurable threshold (default: 40 px in normalised video space), THE Gesture_Classifier SHALL emit a `pinch` event for that hand.
2. WHEN the index finger is extended (MCP-to-tip vector length above threshold) and the middle, ring, and pinky fingers are curled (tip-to-MCP distance below threshold), THE Gesture_Classifier SHALL emit a `point` event for that hand.
3. WHEN all five finger tip landmarks of a detected hand are above their respective MCP landmarks (fingers extended upward), THE Gesture_Classifier SHALL emit an `open_hand` event for that hand.
4. WHEN both hands are simultaneously detected and both hands emit a `pinch` event within the same detection frame, THE Gesture_Classifier SHALL emit a `two_hand_pinch` event containing the landmark data for both hands.
5. WHEN a hand transitions from one gesture state to another, THE Gesture_Classifier SHALL emit the new gesture event and suppress the previous gesture event within the same frame.
6. THE Gesture_Classifier SHALL apply a debounce of at least 3 consecutive frames before emitting a gesture state change, to prevent flickering between gesture states.

---

### Requirement 6: Single-Hand Object Interaction (Pinch — Grab and Drag)

**User Story:** As a visitor, I want to grab and drag the cube with a pinch gesture, so that I can reposition it in the 3D room.

#### Acceptance Criteria

1. WHEN a `pinch` event is emitted and the projected screen position of the pinch point intersects an Interactive_Object via raycasting, THE Interaction_Manager SHALL enter a `grabbed` state for that Interactive_Object.
2. WHILE the Interaction_Manager is in the `grabbed` state, THE Interaction_Manager SHALL update the Interactive_Object's XY world position each frame to follow the projected screen position of the pinch point.
3. WHEN an `open_hand` event is emitted while the Interaction_Manager is in the `grabbed` state, THE Interaction_Manager SHALL exit the `grabbed` state and leave the Interactive_Object at its current position.
4. WHEN the Interaction_Manager enters the `grabbed` state, THE Three_Scene SHALL apply a glow or emissive highlight effect to the grabbed Interactive_Object to provide visual feedback.
5. WHEN the Interaction_Manager exits the `grabbed` state, THE Three_Scene SHALL remove the glow/emissive highlight from the Interactive_Object.

---

### Requirement 7: Single-Hand Object Interaction (Point — Highlight and Rotate)

**User Story:** As a visitor, I want to point at the cube to highlight it and rotate it, so that I can inspect it from different angles.

#### Acceptance Criteria

1. WHEN a `point` event is emitted and the projected screen position of the index finger tip intersects an Interactive_Object via raycasting, THE Interaction_Manager SHALL enter a `pointed` state for that Interactive_Object.
2. WHILE the Interaction_Manager is in the `pointed` state, THE Three_Scene SHALL apply a distinct highlight colour to the Interactive_Object to indicate it is selected.
3. WHILE the Interaction_Manager is in the `pointed` state, THE Interaction_Manager SHALL rotate the Interactive_Object around its Y-axis at a constant speed proportional to the horizontal velocity of the index finger tip landmark.
4. WHEN the `point` gesture is no longer detected, THE Interaction_Manager SHALL exit the `pointed` state and THE Three_Scene SHALL remove the highlight from the Interactive_Object.

---

### Requirement 8: Depth Control (Z-Axis Push and Pull)

**User Story:** As a visitor, I want to push or pull the grabbed object toward or away from me using hand size, so that I can control its depth in the scene.

#### Acceptance Criteria

1. WHILE the Interaction_Manager is in the `grabbed` state, THE Interaction_Manager SHALL compute a Depth_Estimate each frame from the apparent bounding-box size of the detected hand in normalised video space.
2. THE Interaction_Manager SHALL map the Depth_Estimate to a Z-axis world position offset for the grabbed Interactive_Object, where a larger hand bounding box (hand closer to camera) maps to a smaller Z value (object closer to viewer) and a smaller bounding box maps to a larger Z value (object further away).
3. THE Interaction_Manager SHALL apply the Z-axis offset using linear interpolation each frame so that depth movement is smooth.
4. THE Interaction_Manager SHALL clamp the Z-axis world position of the Interactive_Object within a configurable range (default: −300 to +300 units) to prevent the object from leaving the Room_Scene bounds.

---

### Requirement 9: Two-Hand Object Rotation

**User Story:** As a visitor, I want to use both hands to rotate the cube freely in 3D, so that I can view it from any angle.

#### Acceptance Criteria

1. WHEN a `two_hand_pinch` event is emitted and both pinch points intersect or are near an Interactive_Object, THE Interaction_Manager SHALL enter a `two_hand_rotate` state for that Interactive_Object.
2. WHILE the Interaction_Manager is in the `two_hand_rotate` state, THE Interaction_Manager SHALL compute the rotation delta each frame from the change in the vector between the two pinch point screen positions.
3. WHILE the Interaction_Manager is in the `two_hand_rotate` state, THE Interaction_Manager SHALL apply the computed rotation delta to the Interactive_Object's X and Y rotation axes.
4. WHEN either hand releases the pinch (emits `open_hand`) while in the `two_hand_rotate` state, THE Interaction_Manager SHALL exit the `two_hand_rotate` state and leave the Interactive_Object at its current rotation.

---

### Requirement 10: Webcam Overlay Display

**User Story:** As a visitor, I want to see my webcam feed with hand and face overlays in the corner, so that I can understand what the system is detecting.

#### Acceptance Criteria

1. THE Webcam_Overlay SHALL display the mirrored webcam feed at 160×120 px in the top-right corner of the viewport at all times after the webcam is initialised.
2. THE Hand_Skeleton_Overlay SHALL draw MediaPipe hand landmarks as filled circles and connections as lines on top of the webcam feed within the Webcam_Overlay canvas.
3. THE Camera_Controller SHALL draw the OpenCV face detection bounding rectangle on the Webcam_Overlay output canvas using colour `#F67D3E`.
4. WHEN both hand skeleton and face bounding box are active simultaneously, THE Webcam_Overlay SHALL render both overlays on the same canvas without one clearing the other.
5. THE Webcam_Overlay canvas SHALL be horizontally flipped (mirrored) so that the display matches the user's natural mirror expectation.

---

### Requirement 11: Removal of Legacy Systems

**User Story:** As a developer, I want the old Teachable Machine and Spline dependencies removed, so that the codebase is clean and does not load unused libraries.

#### Acceptance Criteria

1. THE App SHALL not load the `@teachablemachine/pose` script or the `@tensorflow/tfjs` script.
2. THE App SHALL not load the `@splinetool/runtime` module.
3. THE App SHALL not contain any references to `tmPose`, `tmModel`, `splineApp`, `splineCamera`, `MODE_SEQUENCE`, `MODE_SCROLL_LISTS`, `triggerKey`, or `triggerSafeSequence`.
4. THE App SHALL not dispatch synthetic `KeyboardEvent` objects to any canvas element.
