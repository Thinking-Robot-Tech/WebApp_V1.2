// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBxwM04W_3vHbXbNb7cvEXWUi3udRVXFXk",
    authDomain: "pico-iot-v1-2-9cf83.firebaseapp.com",
    projectId: "pico-iot-v1-2-9cf83",
    storageBucket: "pico-iot-v1-2-9cf83.appspot.com",
    messagingSenderId: "638387216051",
    appId: "1:638387216051:web:721a2747d1bd6fed829ac6",
    measurementId: "G-P10ENCQYRB"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;
let allDevices = [];
let userRooms = [];
let activeRoomFilter = 'All';
let claimProcessData = {};
let qrScanner = null;
let videoStream = null;
let draggedRoom = null;
let placeholder = null; // NEW: Placeholder for drag and drop
let unsubscribeFromDevices = null;
let unsubscribeFromUser = null;
// NEW: State for touch drag delay
let dragTimer = null;
let isDragging = false;
const DRAG_DELAY = 500; // 500ms delay for long press

// --- Device Icon Library ---
const deviceIcons = {
    'default': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    'bulb': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
    'socket': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0-2.2-1.8-4-4-4H9.5A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H14a4 4 0 0 0 4-4Z"/><path d="M8 12h3"/><path d="M15 12h.01"/></svg>`,
    'fan': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/><path d="M12 12v8"/><path d="m16 16-3-3"/><path d="m8 16 3-3"/></svg>`,
    'tv': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    'ac': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0v-6a6 6 0 0 0-6-6z"/><path d="m9 12 2 2 2-2"/><path d="M9 9h6"/></svg>`,
    'geyser': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9a3 3 0 0 0-3 3v7.5a2.5 2.5 0 0 0 5 0V12a3 3 0 0 0-3-3z"/><path d="M12 9V3m-3 3 3-3 3 3"/></svg>`,
    'lamp': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-4.1 4.1c-.6.6-1.5.6-2.1 0l-1-1c-.6-.6-.6-1.5 0-2.1L11 9"/><path d="m18 13 2.1-2.1c.6-.6.6-1.5 0-2.1l-1-1c-.6-.6-1.5-.6-2.1 0L13 11"/><path d="M14 9.5 11 13"/><path d="M13 18h5"/><path d="M4 22h16"/></svg>`,
    'power': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    'cctv': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4z"/><path d="M12 16a4 4 0 0 0-4 4v2h8v-2a4 4 0 0 0-4-4z"/></svg>`,
    'speaker': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`,
    'wifi': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a8 8 0 0 1 14 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M8 16.29a4 4 0 0 1 8 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
    'fridge': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM5 10h14M8 6v2"/></svg>`,
    'bed': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16h20V4H2z"/><path d="M2 9h20"/><path d="M10 12v5"/><path d="M14 12v5"/></svg>`,
    'kitchen': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h20"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`,
};

// --- DOM Element References ---
const welcomeMessage = document.getElementById('welcome-message');
const deviceListContainer = document.getElementById('device-list-container');
const roomsFilterBar = document.getElementById('rooms-filter-bar');
const roomActionsContainer = document.getElementById('room-actions-container');
const addDeviceModal = document.getElementById('add-device-modal');
const addRoomModal = document.getElementById('add-room-modal');
const editRoomModal = document.getElementById('edit-room-modal');
const confirmDeviceDeleteModal = document.getElementById('confirm-device-delete-modal');
const confirmRoomDeleteModal = document.getElementById('confirm-room-delete-modal');
const addRoomForm = document.getElementById('add-room-form');
const editRoomForm = document.getElementById('edit-room-form');
const deleteRoomBtn = document.getElementById('delete-room-btn');
const roomSettingsBtn = document.getElementById('room-settings-btn');
const editDeviceModal = document.getElementById('edit-device-modal');
const editDeviceForm = document.getElementById('edit-device-form');
const editDeviceNameInput = document.getElementById('edit-device-name');
const iconSelectionGrid = document.getElementById('icon-selection-grid');
const factoryResetBtn = document.getElementById('factory-reset-btn');
const deleteDeviceFromAppBtn = document.getElementById('delete-device-from-app-btn');

// --- Functions ---

const applyTheme = (theme) => {
    const currentTheme = theme || 'dark';
    document.documentElement.dataset.theme = currentTheme;
    try {
        localStorage.setItem('pico-theme', currentTheme);
    } catch (e) {
        console.error('Failed to save theme to localStorage:', e);
    }
};

const toggleModal = (modalElement, show) => {
    if (modalElement) {
        modalElement.classList.toggle('visible', show);
    }
};


const renderRoomFilters = () => {
    if (!roomsFilterBar) return;
    roomsFilterBar.innerHTML = '';
    ['All', ...userRooms].forEach(room => {
        const roomBtn = document.createElement('button');
        roomBtn.className = 'room-filter-btn';
        roomBtn.textContent = room === 'All' ? 'All Devices' : room;
        roomBtn.dataset.room = room;
        if (activeRoomFilter === room) roomBtn.classList.add('active');
        if (room !== 'All') roomBtn.draggable = true;
        roomsFilterBar.appendChild(roomBtn);
    });
};



const handleAddRoom = async (e) => {
    e.preventDefault();
    const newRoomNameInput = document.getElementById('new-room-name');
    const newRoomName = newRoomNameInput.value.trim();
    if (newRoomName && currentUserId && !userRooms.includes(newRoomName)) {
        const userDocRef = doc(db, 'users', currentUserId);
        await updateDoc(userDocRef, { rooms: arrayUnion(newRoomName) });
    }
    newRoomNameInput.value = '';
    toggleModal(addRoomModal, false);
};

const openEditRoomModal = (roomName) => {
    if (!editRoomModal) return;
    const roomNameInput = document.getElementById('edit-room-name');
    const devicesListDiv = document.getElementById('devices-in-room-list');
    roomNameInput.value = roomName;
    editRoomForm.dataset.originalRoomName = roomName;
    const devicesInRoom = allDevices.filter(d => d.room === roomName);
    devicesListDiv.innerHTML = devicesInRoom.length > 0
        ? devicesInRoom.map(d => `<div class="device-list-item"><span>${d.name}</span></div>`).join('')
        : `<p>No devices in this room.</p>`;
    toggleModal(editRoomModal, true);
};

const handleEditRoom = async (e) => {
    e.preventDefault();
    const originalName = editRoomForm.dataset.originalRoomName;
    const newName = document.getElementById('edit-room-name').value.trim();
    if (!newName || newName === originalName) {
        toggleModal(editRoomModal, false);
        return;
    }
    const newRooms = userRooms.map(r => r === originalName ? newName : r);
    const userDocRef = doc(db, 'users', currentUserId);
    await updateDoc(userDocRef, { rooms: newRooms });
    const devicesToUpdate = allDevices.filter(d => d.room === originalName);
    if (devicesToUpdate.length > 0) {
        const batch = writeBatch(db);
        devicesToUpdate.forEach(device => {
            const deviceRef = doc(db, 'devices', device.id);
            batch.update(deviceRef, { room: newName });
        });
        await batch.commit();
    }
    if (activeRoomFilter === originalName) activeRoomFilter = newName;
    toggleModal(editRoomModal, false);
};

const handleDeleteRoom = async () => {
    const roomToDelete = editRoomForm.dataset.originalRoomName;
    const newRooms = userRooms.filter(r => r !== roomToDelete);
    const userDocRef = doc(db, 'users', currentUserId);
    await updateDoc(userDocRef, { rooms: newRooms });
    const devicesToUpdate = allDevices.filter(d => d.room === roomToDelete);
    if (devicesToUpdate.length > 0) {
        const batch = writeBatch(db);
        devicesToUpdate.forEach(device => {
            const deviceRef = doc(db, 'devices', device.id);
            batch.update(deviceRef, { room: 'Unassigned' });
        });
        await batch.commit();
    }
    if (activeRoomFilter === roomToDelete) activeRoomFilter = 'All';
    toggleModal(confirmRoomDeleteModal, false);
    toggleModal(editRoomModal, false);
};

// --- Device Rendering & Actions ---
const renderDevices = () => {
    if (!deviceListContainer) return;
    const devicesToRender = activeRoomFilter === 'All'
        ? allDevices
        : allDevices.filter(device => device.room === activeRoomFilter);

    if (devicesToRender.length === 0) {
        deviceListContainer.innerHTML = `<div class="empty-state"><h3>No Devices in ${activeRoomFilter}</h3><p>Add a new device or select another room.</p></div>`;
    } else {
        deviceListContainer.innerHTML = '<div class="device-grid"></div>';
        const grid = deviceListContainer.querySelector('.device-grid');
        devicesToRender.sort((a, b) => a.name.localeCompare(b.name)).forEach(device => {
            const card = document.createElement('div');
            card.className = 'device-card';
            const isOnline = device.state?.isOnline ?? false;
            const isOn = device.state?.isOn ?? false;
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-icon">${getDeviceIcon(device)}</div>
                    <div class="card-status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</div>
                </div>
                <div class="card-main">
                    <h4 class="card-title">${device.name || 'Unnamed Device'}</h4>
                    <p class="card-type">${device.room || 'Unassigned'} - ${device.type || 'PICO Device'}</p>
                </div>
                <div class="card-bottom">
                    <button class="edit-btn" aria-label="Edit Device"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                    <label class="switch"><input type="checkbox" class="device-toggle" ${isOn ? 'checked' : ''} ${!isOnline ? 'disabled' : ''}><span class="slider round"></span></label>
                </div>`;
            card.querySelector('.device-toggle').addEventListener('change', () => handleToggleDevice(device.id, isOn));
            card.querySelector('.edit-btn').addEventListener('click', () => openEditDeviceModal(device));
            grid.appendChild(card);
        });
    }
    if (roomActionsContainer) {
        roomActionsContainer.style.display = activeRoomFilter !== 'All' ? 'block' : 'none';
    }
};

const getDeviceIcon = (device) => {
    if (device.iconId && deviceIcons[device.iconId]) {
        return deviceIcons[device.iconId];
    }
    switch (device.type) {
        case 'PICO-SOCT': return deviceIcons['socket'];
        case 'PICO-BLB1': return deviceIcons['bulb'];
        default: return deviceIcons['default'];
    }
};

const openEditDeviceModal = (device) => {
    if (!editDeviceModal) return;
    
    editDeviceForm.dataset.deviceId = device.id;
    editDeviceNameInput.value = device.name;

    iconSelectionGrid.innerHTML = '';
    Object.entries(deviceIcons).forEach(([id, svg]) => {
        if (id === 'default') return;
        const iconOption = document.createElement('button');
        iconOption.type = 'button';
        iconOption.className = 'icon-option';
        iconOption.dataset.iconId = id;
        iconOption.innerHTML = svg;
        if ((device.iconId || 'bulb') === id) { 
            iconOption.classList.add('selected');
        }
        iconSelectionGrid.appendChild(iconOption);
    });
    
    toggleModal(editDeviceModal, true);
};

const handleUpdateDevice = async (e) => {
    e.preventDefault();
    const deviceId = e.target.dataset.deviceId;
    const newName = editDeviceNameInput.value.trim();
    const selectedIcon = iconSelectionGrid.querySelector('.icon-option.selected');
    const newIconId = selectedIcon ? selectedIcon.dataset.iconId : 'default';

    if (!deviceId || !newName) return;

    const deviceRef = doc(db, 'devices', deviceId);
    try {
        await updateDoc(deviceRef, {
            name: newName,
            iconId: newIconId
        });
        toggleModal(editDeviceModal, false);
    } catch (error) {
        console.error("Error updating device:", error);
        alert("Failed to update device.");
    }
};

const handleFactoryReset = async () => {
    const deviceId = editDeviceForm.dataset.deviceId;
    if (!deviceId) return;
    if (confirm(`Are you sure you want to factory reset this device? It will need to be re-configured to connect to your Wi-Fi again.`)) {
        const deviceRef = doc(db, 'devices', deviceId);
        try {
            await updateDoc(deviceRef, { factoryReset: true });
            toggleModal(editDeviceModal, false);
            alert("Factory reset command sent. The device will disconnect and reset.");
        } catch (error) {
            console.error("Error sending factory reset command:", error);
        }
    }
};

const startQrScanner = async () => {
    if (!window.isSecureContext) {
        alert("Camera access is only available on secure (https) pages or localhost.");
        return;
    }
    const qrVideo = document.getElementById('qr-video');
    if (!qrVideo) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        qrVideo.srcObject = videoStream;
        await qrVideo.play();
        goToStep('qr');
        scanFrame(); 
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert("Could not access camera. Please ensure you've given permission.");
        resetAddDeviceModal();
    }
};

const stopQrScanner = () => {
    if (qrScanner) cancelAnimationFrame(qrScanner);
    qrScanner = null;
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
};

const scanFrame = () => {
    const qrVideo = document.getElementById('qr-video');
    if (qrVideo && qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = qrVideo.videoWidth;
        canvas.height = qrVideo.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

        if (code) {
            stopQrScanner();
            claimProcessData.macAddress = code.data;
            claimProcessData.isVirtual = false;
            goToStep(2);
            return;
        }
    }
    qrScanner = requestAnimationFrame(scanFrame);
};

const goToStep = (stepNumber) => {
    [document.getElementById('claim-step-1'), document.getElementById('claim-step-2'), document.getElementById('claim-step-3'), document.getElementById('qr-scanner-view')].forEach(el => {
        if (el) el.style.display = 'none';
    });
    const steps = { 1: 'claim-step-1', 2: 'claim-step-2', 3: 'claim-step-3', 'qr': 'qr-scanner-view' };
    const stepElement = document.getElementById(steps[stepNumber]);
    if (stepElement) stepElement.style.display = 'block';
    if (stepNumber === 2) {
        const roomSelect = document.getElementById('room-select');
        if (roomSelect) {
            roomSelect.innerHTML = '';
            [...userRooms, 'Unassigned'].forEach(room => {
                const option = document.createElement('option');
                option.value = room;
                option.textContent = room;
                roomSelect.appendChild(option);
            });
        }
    }
};

const generateClaimCode = () => `PICO-${Array(4).fill(0).map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.length))).join('')}`;

const handleStartClaimProcess = async () => {
    if (!currentUserId || !claimProcessData.macAddress) return;
    const claimCode = generateClaimCode();
    claimProcessData.claimCode = claimCode;
    const claimRef = doc(db, 'deviceClaims', claimProcessData.macAddress);
    try {
        await setDoc(claimRef, {
            ownerId: currentUserId,
            claimCode: claimCode,
            deviceName: claimProcessData.deviceName,
            room: claimProcessData.room,
            isVirtual: claimProcessData.isVirtual,
            createdAt: serverTimestamp()
        });
        if(document.getElementById('claim-code-display')) document.getElementById('claim-code-display').textContent = claimCode;
        if(document.getElementById('go-to-virtual-form-btn')) document.getElementById('go-to-virtual-form-btn').style.display = claimProcessData.isVirtual ? 'block' : 'none';
        goToStep(3);
    } catch (error) {
        console.error("Error creating device claim:", error);
        alert("Could not start the claim process.");
        resetAddDeviceModal();
    }
};

const handleToggleDevice = async (deviceId, currentState) => {
    const deviceRef = doc(db, 'devices', deviceId);
    await updateDoc(deviceRef, { "state.isOn": !currentState });
};

const openDeleteConfirmation = (id, name, type) => {
    if (type === 'device') {
        const modal = document.getElementById('confirm-device-delete-modal');
        modal.querySelector('p').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
        modal.querySelector('.confirm-btn').dataset.deviceId = id;
        toggleModal(modal, true);
    }
};

const handleDeleteDevice = async (e) => {
    const deviceId = e.target.dataset.deviceId;
    if (deviceId) {
        await deleteDoc(doc(db, 'devices', deviceId));
    }
    toggleModal(document.getElementById('confirm-device-delete-modal'), false);
};

const setupListeners = (userId) => {
    if (unsubscribeFromUser) unsubscribeFromUser();
    if (unsubscribeFromDevices) unsubscribeFromDevices();

    const userDocRef = doc(db, "users", userId);
    unsubscribeFromUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            const { familyMembers = [], settings = {} } = userData;
            const activeMember = familyMembers.find(m => m.id === settings.activeMemberId) || familyMembers[0];
            
            if (welcomeMessage) {
                welcomeMessage.textContent = activeMember ? `Hey, ${activeMember.name}` : 'Welcome';
            }
            
            userRooms = userData.rooms || [];
            const savedTheme = userData.settings?.theme || 'dark';
            applyTheme(savedTheme);
            renderRoomFilters();
            renderDevices();
        } else {
            console.log("User document not found for ID:", userId);
        }
    }, (error) => console.error("Error fetching user data:", error));

    const devicesQuery = query(collection(db, 'devices'), where("ownerId", "==", userId));
    unsubscribeFromDevices = onSnapshot(devicesQuery, (snapshot) => {
        allDevices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDevices();
    }, (error) => console.error("Error fetching devices: ", error));
};

const cleanupListeners = () => {
    if (unsubscribeFromUser) unsubscribeFromUser();
    if (unsubscribeFromDevices) unsubscribeFromDevices();
    currentUserId = null;
    allDevices = [];
    userRooms = [];
};

const addSafeEventListener = (element, event, handler) => {
    if (element) element.addEventListener(event, handler);
};

const resetAddDeviceModal = () => {
    stopQrScanner();
    claimProcessData = {};
    goToStep(1);
    const manualMacForm = document.getElementById('manual-mac-form');
    const deviceDetailsForm = document.getElementById('device-details-form');
    if(manualMacForm) manualMacForm.reset();
    if(deviceDetailsForm) deviceDetailsForm.reset();
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (currentUserId !== user.uid) {
                currentUserId = user.uid;
                setupListeners(user.uid);
            }
        } else {
            cleanupListeners();
            window.location.href = 'index.html';
        }
    });

    addSafeEventListener(editDeviceForm, 'submit', handleUpdateDevice);
    addSafeEventListener(factoryResetBtn, 'click', handleFactoryReset);
    addSafeEventListener(deleteDeviceFromAppBtn, 'click', () => {
        const deviceId = editDeviceForm.dataset.deviceId;
        const device = allDevices.find(d => d.id === deviceId);
        if (device) {
            toggleModal(editDeviceModal, false);
            openDeleteConfirmation(deviceId, device.name, 'device');
        }
    });
    addSafeEventListener(iconSelectionGrid, 'click', (e) => {
        const target = e.target.closest('.icon-option');
        if (target) {
            iconSelectionGrid.querySelector('.selected')?.classList.remove('selected');
            target.classList.add('selected');
        }
    });
    addSafeEventListener(editDeviceModal.querySelector('.close-modal-btn'), 'click', () => toggleModal(editDeviceModal, false));
    
    addSafeEventListener(document.getElementById('add-device-fab'), 'click', () => { resetAddDeviceModal(); toggleModal(addDeviceModal, true); });
    addSafeEventListener(document.getElementById('add-room-btn'), 'click', () => toggleModal(addRoomModal, true));
    addSafeEventListener(addRoomForm, 'submit', handleAddRoom);
    addSafeEventListener(editRoomForm, 'submit', handleEditRoom);
    addSafeEventListener(deleteRoomBtn, 'click', () => toggleModal(confirmRoomDeleteModal, true));
    addSafeEventListener(roomSettingsBtn, 'click', () => openEditRoomModal(activeRoomFilter));
    addSafeEventListener(roomsFilterBar, 'click', (e) => {
        if (e.target.classList.contains('room-filter-btn') && !isDragging) {
            activeRoomFilter = e.target.dataset.room;
            renderRoomFilters();
            renderDevices();
        }
    });
    
    const getDragAfterElement = (container, x) => {
        const draggableElements = [...container.querySelectorAll('.room-filter-btn:not(.dragging):not([data-room="All"])')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    const saveRoomOrder = async () => {
        const newOrder = [...roomsFilterBar.querySelectorAll('.room-filter-btn')]
            .map(btn => btn.dataset.room)
            .filter(room => room !== 'All');
        
        if (JSON.stringify(newOrder) !== JSON.stringify(userRooms)) {
            userRooms = newOrder;
            const userDocRef = doc(db, 'users', currentUserId);
            await updateDoc(userDocRef, { rooms: newOrder });
        }
    };

    addSafeEventListener(roomsFilterBar, 'dragstart', (e) => {
        if (e.target.classList.contains('room-filter-btn') && e.target.dataset.room !== 'All') {
            draggedRoom = e.target;
            // NEW: Create a placeholder and hide the original element
            placeholder = document.createElement('div');
            placeholder.className = 'room-filter-placeholder';
            placeholder.style.width = draggedRoom.offsetWidth + 'px';
            placeholder.style.height = draggedRoom.offsetHeight + 'px';
            placeholder.style.border = '1px dashed var(--border-color)';
            placeholder.style.borderRadius = '99px';
            placeholder.style.marginRight = '8px'; // Match gap
            placeholder.style.boxSizing = 'border-box';


            roomsFilterBar.insertBefore(placeholder, draggedRoom);
            draggedRoom.style.display = 'none'; // Hide original element during drag
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedRoom.dataset.room); // Required for Firefox
        }
    });

    addSafeEventListener(roomsFilterBar, 'dragend', () => {
        if (draggedRoom) {
            // NEW: Restore original element and remove placeholder
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedRoom, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            draggedRoom.style.display = ''; // Show original element
            draggedRoom.classList.remove('dragging');
            draggedRoom = null;
            placeholder = null;
        }
    });

    addSafeEventListener(roomsFilterBar, 'dragover', (e) => {
        e.preventDefault();
        if (!draggedRoom || !placeholder) return;
        const afterElement = getDragAfterElement(roomsFilterBar, e.clientX);
        if (afterElement == null) {
            roomsFilterBar.appendChild(placeholder);
        } else {
            roomsFilterBar.insertBefore(placeholder, afterElement);
        }
    });

    addSafeEventListener(roomsFilterBar, 'drop', (e) => {
        e.preventDefault();
        if (draggedRoom) {
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedRoom, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            draggedRoom.style.display = ''; // Show original element
            draggedRoom.classList.remove('dragging');
            saveRoomOrder();
            draggedRoom = null;
            placeholder = null;
        }
    });

    // --- MODIFIED: Touch Events with Long-Press Delay ---
    addSafeEventListener(roomsFilterBar, 'touchstart', (e) => {
        const target = e.target.closest('.room-filter-btn');
        if (target && target.dataset.room !== 'All') {
            clearTimeout(dragTimer); // Clear any previous timer
            dragTimer = setTimeout(() => {
                isDragging = true;
                draggedRoom = target;
                draggedRoom.classList.add('dragging');

                // NEW: Create a placeholder and hide the original element for touch
                placeholder = document.createElement('div');
                placeholder.className = 'room-filter-placeholder';
                placeholder.style.width = draggedRoom.offsetWidth + 'px';
                placeholder.style.height = draggedRoom.offsetHeight + 'px';
                placeholder.style.border = '1px dashed var(--border-color)';
                placeholder.style.borderRadius = '99px';
                placeholder.style.marginRight = '8px'; // Match gap
                placeholder.style.boxSizing = 'border-box';

                roomsFilterBar.insertBefore(placeholder, draggedRoom);
                draggedRoom.style.display = 'none'; // Hide original element during drag

                document.body.style.overflow = 'hidden'; 
            }, DRAG_DELAY);
        }
    });

    addSafeEventListener(roomsFilterBar, 'touchmove', (e) => {
        // If we move before the timer fires, it's a scroll, not a drag.
        if (!isDragging) {
            clearTimeout(dragTimer); 
            return;
        }
        if (!draggedRoom || !placeholder) return;
        
        e.preventDefault(); // This is important to prevent the screen from scrolling
        const touch = e.touches[0];
        const afterElement = getDragAfterElement(roomsFilterBar, touch.clientX);
        if (afterElement == null) {
            roomsFilterBar.appendChild(placeholder);
        } else {
            roomsFilterBar.insertBefore(placeholder, afterElement);
        }
    });

    addSafeEventListener(roomsFilterBar, 'touchend', () => {
        clearTimeout(dragTimer);
        if (isDragging && draggedRoom) {
            // NEW: Restore original element and remove placeholder for touch
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(draggedRoom, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            draggedRoom.style.display = ''; // Show original element
            draggedRoom.classList.remove('dragging');
            
            saveRoomOrder();
        }
        isDragging = false;
        draggedRoom = null;
        placeholder = null;
        document.body.style.overflow = ''; // Re-enable scrolling
    });
    // --- End of Drag-and-Drop Fix ---

    [addDeviceModal, addRoomModal, editRoomModal, confirmDeviceDeleteModal, confirmRoomDeleteModal].forEach(modal => {
        if (modal && modal.id !== 'edit-device-modal') {
            addSafeEventListener(modal.querySelector('.close-modal-btn'), 'click', () => toggleModal(modal, false));
        }
        modal.querySelectorAll('.cancel-btn')?.forEach(btn => addSafeEventListener(btn, 'click', () => toggleModal(modal, false)));
    });
    addSafeEventListener(confirmDeviceDeleteModal?.querySelector('.confirm-btn'), 'click', handleDeleteDevice);
    addSafeEventListener(confirmRoomDeleteModal?.querySelector('.confirm-btn'), 'click', handleDeleteRoom);
    
    addSafeEventListener(document.getElementById('scan-qr-btn'), 'click', startQrScanner);
    addSafeEventListener(document.getElementById('cancel-scan-btn'), 'click', () => { stopQrScanner(); goToStep(1); });
    addSafeEventListener(document.getElementById('manual-mac-form'), 'submit', (e) => {
        e.preventDefault();
        claimProcessData.macAddress = document.getElementById('device-mac-input').value.trim();
        if (claimProcessData.macAddress) {
            claimProcessData.isVirtual = false;
            goToStep(2);
        }
    });
    addSafeEventListener(document.getElementById('add-virtual-device-btn'), 'click', () => {
        claimProcessData.macAddress = 'VIRT:' + Array(5).fill(0).map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();
        claimProcessData.isVirtual = true;
        goToStep(2);
    });
    addSafeEventListener(document.getElementById('device-details-form'), 'submit', (e) => {
        e.preventDefault();
        claimProcessData.deviceName = document.getElementById('device-name-input').value.trim();
        claimProcessData.room = document.getElementById('room-select').value;
        handleStartClaimProcess();
    });
    addSafeEventListener(addDeviceModal?.querySelector('.back-btn'), 'click', () => goToStep(1));
    addSafeEventListener(document.getElementById('copy-code-btn'), 'click', () => {
        if (claimProcessData.claimCode) {
            navigator.clipboard.writeText(claimProcessData.claimCode).then(() => {
                const btn = document.getElementById('copy-code-btn');
                if(btn) btn.textContent = 'Copied!';
                setTimeout(() => { if(btn) btn.textContent = 'Copy'; }, 2000);
            });
        }
    });
    addSafeEventListener(document.getElementById('go-to-virtual-form-btn'), 'click', () => {
        window.open(`form.html?mac=${encodeURIComponent(claimProcessData.macAddress)}&code=${claimProcessData.claimCode}`, '_blank');
        toggleModal(addDeviceModal, false);
    });
});
