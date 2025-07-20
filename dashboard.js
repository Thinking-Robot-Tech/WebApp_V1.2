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

// --- Global State ---
let currentUserId = null;
let allDevices = [];
let userRooms = [];
let activeRoomFilter = 'All';
let claimProcessData = {};
let qrScanner = null;
let videoStream = null;
let draggedRoom = null; // RESTORED: For drag-and-drop functionality
let unsubscribeFromDevices = null;
let unsubscribeFromUser = null;

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

// --- Room Management ---
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
                    <div class="card-icon">${getDeviceIcon(device.type)}</div>
                    <div class="card-status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</div>
                </div>
                <div class="card-main">
                    <h4 class="card-title">${device.name || 'Unnamed Device'}</h4>
                    <p class="card-type">${device.room || 'Unassigned'} - ${device.type || 'PICO Device'}</p>
                </div>
                <div class="card-bottom">
                    <button class="delete-btn" aria-label="Delete Device"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                    <label class="switch"><input type="checkbox" class="device-toggle" ${isOn ? 'checked' : ''} ${!isOnline ? 'disabled' : ''}><span class="slider round"></span></label>
                </div>`;
            card.querySelector('.device-toggle').addEventListener('change', () => handleToggleDevice(device.id, isOn));
            card.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirmation(device.id, device.name, 'device'));
            grid.appendChild(card);
        });
    }
    if (roomActionsContainer) {
        roomActionsContainer.style.display = activeRoomFilter !== 'All' ? 'block' : 'none';
    }
};

const getDeviceIcon = (type) => {
    switch (type) {
        case 'PICO-SOCT': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0-2.2-1.8-4-4-4H9.5A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H14a4 4 0 0 0 4-4Z"/><path d="M8 12h3"/><path d="M15 12h.01"/></svg>`;
        case 'PICO-BLB1': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
        case 'PICO-VRT1': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M12 14a2 2 0 0 1-2-2 2 2 0 0 1 2-2"/><path d="M12 14a6 6 0 0 0-6 6 4 4 0 0 0 4 4 6 6 0 0 0 6-6 4 4 0 0 0 4 4 6 6 0 0 0 6-6 4 4 0 0 0-4-4"/></svg>`;
        default: return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
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

// --- Auth & Data Fetching ---
const setupListeners = (userId) => {
    if (unsubscribeFromUser) unsubscribeFromUser();
    if (unsubscribeFromDevices) unsubscribeFromDevices();

    const userDocRef = doc(db, "users", userId);
    unsubscribeFromUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            const profileName = userData.profile?.name || userData.name || 'User';
            if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${profileName}`;
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

// --- Main Entry Point ---
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

    addSafeEventListener(document.getElementById('add-device-fab'), 'click', () => { resetAddDeviceModal(); toggleModal(addDeviceModal, true); });
    addSafeEventListener(document.getElementById('add-room-btn'), 'click', () => toggleModal(addRoomModal, true));
    addSafeEventListener(addRoomForm, 'submit', handleAddRoom);
    addSafeEventListener(editRoomForm, 'submit', handleEditRoom);
    addSafeEventListener(deleteRoomBtn, 'click', () => toggleModal(confirmRoomDeleteModal, true));
    addSafeEventListener(roomSettingsBtn, 'click', () => openEditRoomModal(activeRoomFilter));
    addSafeEventListener(roomsFilterBar, 'click', (e) => {
        if (e.target.classList.contains('room-filter-btn')) {
            activeRoomFilter = e.target.dataset.room;
            renderRoomFilters();
            renderDevices();
        }
    });

    // RESTORED: Drag-and-drop event listeners for room reordering
    addSafeEventListener(roomsFilterBar, 'dragstart', (e) => {
        if (e.target.classList.contains('room-filter-btn') && e.target.dataset.room !== 'All') {
            draggedRoom = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    addSafeEventListener(roomsFilterBar, 'dragend', (e) => {
        if (draggedRoom) {
            draggedRoom.classList.remove('dragging');
            draggedRoom = null;
        }
    });

    addSafeEventListener(roomsFilterBar, 'dragover', (e) => {
        e.preventDefault();
        if (!draggedRoom) return;
        const afterElement = [...roomsFilterBar.querySelectorAll('.room-filter-btn:not(.dragging):not([data-room="All"])')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientX - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        
        if (afterElement == null) {
            roomsFilterBar.appendChild(draggedRoom);
        } else {
            roomsFilterBar.insertBefore(draggedRoom, afterElement);
        }
    });

    addSafeEventListener(roomsFilterBar, 'drop', async (e) => {
        e.preventDefault();
        if (!draggedRoom) return;
        
        const newOrder = [...roomsFilterBar.querySelectorAll('.room-filter-btn')]
            .map(btn => btn.dataset.room)
            .filter(room => room !== 'All');
        
        if (JSON.stringify(newOrder) !== JSON.stringify(userRooms)) {
            userRooms = newOrder;
            const userDocRef = doc(db, 'users', currentUserId);
            await updateDoc(userDocRef, { rooms: newOrder });
        }
    });

    [addDeviceModal, addRoomModal, editRoomModal, confirmDeviceDeleteModal, confirmRoomDeleteModal].forEach(modal => {
        if (modal) {
            addSafeEventListener(modal.querySelector('.close-modal-btn'), 'click', () => toggleModal(modal, false));
            modal.querySelectorAll('.cancel-btn')?.forEach(btn => addSafeEventListener(btn, 'click', () => toggleModal(modal, false)));
        }
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
