// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let claimProcessData = {}; // To hold data between modal steps
let qrScanner = null;
let videoStream = null;

let unsubscribeFromDevices = null;
let unsubscribeFromUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeMessage = document.getElementById('welcome-message');
    const deviceListContainer = document.getElementById('device-list-container');
    const roomsFilterBar = document.getElementById('rooms-filter-bar');
    const addRoomBtn = document.getElementById('add-room-btn');
    const addDeviceFab = document.getElementById('add-device-fab');
    
    // Modals
    const addDeviceModal = document.getElementById('add-device-modal');
    const addRoomModal = document.getElementById('add-room-modal');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    
    // Add Device Modal Steps & Elements
    const claimStep1 = document.getElementById('claim-step-1');
    const claimStep2 = document.getElementById('claim-step-2');
    const claimStep3 = document.getElementById('claim-step-3');
    const qrScannerView = document.getElementById('qr-scanner-view');
    const qrVideo = document.getElementById('qr-video');
    const manualMacForm = document.getElementById('manual-mac-form');
    const scanQrBtn = document.getElementById('scan-qr-btn');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    const addVirtualDeviceBtn = document.getElementById('add-virtual-device-btn');
    const deviceDetailsForm = document.getElementById('device-details-form');
    const deviceNameInput = document.getElementById('device-name-input');
    const roomSelect = document.getElementById('room-select');
    const claimCodeDisplay = document.getElementById('claim-code-display');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const goToVirtualFormBtn = document.getElementById('go-to-virtual-form-btn');
    
    // Other Modal Elements
    const addRoomForm = document.getElementById('add-room-form');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const confirmDeleteText = document.getElementById('confirm-delete-text');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');


    // --- Functions ---

    const toggleModal = (modalElement, show) => {
        if (show) modalElement.classList.add('visible');
        else modalElement.classList.remove('visible');
    };

    const resetAddDeviceModal = () => {
        stopQrScanner();
        claimProcessData = {};
        [claimStep1, claimStep2, claimStep3, qrScannerView].forEach(el => {
            if (el) el.style.display = 'none';
        });
        if (claimStep1) claimStep1.style.display = 'block';
        if(manualMacForm) manualMacForm.reset();
        if(deviceDetailsForm) deviceDetailsForm.reset();
    };

    // --- Room Management ---
    const renderRoomFilters = () => {
        if (!roomsFilterBar) return;
        roomsFilterBar.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.className = 'room-filter-btn';
        allBtn.textContent = 'All Devices';
        allBtn.dataset.room = 'All';
        if (activeRoomFilter === 'All') allBtn.classList.add('active');
        roomsFilterBar.appendChild(allBtn);

        userRooms.forEach(room => {
            const roomBtn = document.createElement('button');
            roomBtn.className = 'room-filter-btn';
            roomBtn.textContent = room;
            roomBtn.dataset.room = room;
            if (activeRoomFilter === room) roomBtn.classList.add('active');
            roomsFilterBar.appendChild(roomBtn);
        });
    };
    
    const handleAddRoom = async (e) => {
        e.preventDefault();
        const newRoomNameInput = document.getElementById('new-room-name');
        const newRoomName = newRoomNameInput.value.trim();
        if (newRoomName && currentUserId && !userRooms.includes(newRoomName)) {
            const userDocRef = doc(db, 'users', currentUserId);
            await setDoc(userDocRef, {
                rooms: arrayUnion(newRoomName)
            }, { merge: true });
        }
        newRoomNameInput.value = '';
        if(addRoomModal) toggleModal(addRoomModal, false);
    };

    // --- Device Rendering & Filtering ---
    const renderDevices = () => {
        if (!deviceListContainer) return;
        const devicesToRender = activeRoomFilter === 'All'
            ? allDevices
            : allDevices.filter(device => device.room === activeRoomFilter);

        if (devicesToRender.length === 0) {
            deviceListContainer.innerHTML = `<div class="empty-state"><h3>No Devices in ${activeRoomFilter}</h3><p>Add a new device or select another room.</p></div>`;
            return;
        }
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
                </div>
            `;
            card.querySelector('.device-toggle').addEventListener('change', () => handleToggleDevice(device.id, isOn));
            card.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirmation(device.id, device.name));
            grid.appendChild(card);
        });
    };
    
    const getDeviceIcon = (type) => {
        switch (type) {
            case 'PICO-SOCT': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0-2.2-1.8-4-4-4H9.5A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H14a4 4 0 0 0 4-4Z"/><path d="M8 12h3"/><path d="M15 12h.01"/></svg>`;
            case 'PICO-BLB1': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
            case 'PICO-VRT1': return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M12 14a2 2 0 0 1-2-2 2 2 0 0 1 2-2"/><path d="M12 14a6 6 0 0 0-6 6 4 4 0 0 0 4 4 6 6 0 0 0 6-6 4 4 0 0 0 4 4 6 6 0 0 0 6-6 4 4 0 0 0-4-4"/></svg>`;
            default: return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
        }
    };
    
    // --- Add Device Flow ---
    const startQrScanner = async () => {
        if (!qrVideo) return;
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            qrVideo.srcObject = videoStream;
            qrVideo.oncanplay = () => {
                if(claimStep1) claimStep1.style.display = 'none';
                if(qrScannerView) qrScannerView.style.display = 'block';
                scanFrame();
            };
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
        [claimStep1, claimStep2, claimStep3, qrScannerView].forEach(el => {
            if (el) el.style.display = 'none';
        });
        if (stepNumber === 1 && claimStep1) claimStep1.style.display = 'block';
        if (stepNumber === 2 && claimStep2) {
            if (roomSelect) {
                roomSelect.innerHTML = '';
                userRooms.forEach(room => {
                    const option = document.createElement('option');
                    option.value = room;
                    option.textContent = room;
                    roomSelect.appendChild(option);
                });
            }
            claimStep2.style.display = 'block';
        }
        if (stepNumber === 3 && claimStep3) claimStep3.style.display = 'block';
    };

    // **FIX**: Added the missing generateClaimCode function
    const generateClaimCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `PICO-${result}`;
    };

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
            
            if(claimCodeDisplay) claimCodeDisplay.textContent = claimCode;
            if(goToVirtualFormBtn) goToVirtualFormBtn.style.display = claimProcessData.isVirtual ? 'block' : 'none';
            goToStep(3);

        } catch (error) {
            console.error("Error creating device claim:", error);
            alert("Could not start the claim process. Please try again.");
            resetAddDeviceModal();
        }
    };

    // --- Other Device Actions ---
    const handleToggleDevice = async (deviceId, currentState) => {
        const deviceRef = doc(db, 'devices', deviceId);
        await updateDoc(deviceRef, { "state.isOn": !currentState });
    };

    const openDeleteConfirmation = (deviceId, deviceName) => {
        if(confirmDeleteText) confirmDeleteText.textContent = `Are you sure you want to delete "${deviceName}"? This action cannot be undone.`;
        if(confirmDeleteBtn) confirmDeleteBtn.dataset.deviceId = deviceId;
        if(confirmDeleteModal) toggleModal(confirmDeleteModal, true);
    };

    const handleDeleteDevice = async () => {
        const deviceId = confirmDeleteBtn.dataset.deviceId;
        if (deviceId) {
            await deleteDoc(doc(db, 'devices', deviceId));
            if(confirmDeleteModal) toggleModal(confirmDeleteModal, false);
        }
    };

    // --- Auth & Data Fetching ---
    const setupListeners = (userId) => {
        if (unsubscribeFromUser) unsubscribeFromUser();
        if (unsubscribeFromDevices) unsubscribeFromDevices();

        const userDocRef = doc(db, "users", userId);
        unsubscribeFromUser = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                if(welcomeMessage) welcomeMessage.textContent = `Welcome, ${userData.name || 'User'}`;
                userRooms = userData.rooms || [];
                renderRoomFilters();
                renderDevices();
            }
        });

        const devicesQuery = query(collection(db, 'devices'), where("ownerId", "==", userId));
        unsubscribeFromDevices = onSnapshot(devicesQuery, (querySnapshot) => {
            allDevices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDevices();
        }, (error) => {
            console.error("Error fetching devices: ", error);
            if(deviceListContainer) deviceListContainer.innerHTML = `<div class="empty-state"><h3>Error</h3><p>Could not load your devices.</p></div>`;
        });
    };

    const cleanupListeners = () => {
        if (unsubscribeFromUser) unsubscribeFromUser();
        if (unsubscribeFromDevices) unsubscribeFromDevices();
        currentUserId = null;
        allDevices = [];
        userRooms = [];
    };

    // --- Event Listeners Setup ---
    const addSafeEventListener = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Could not find element to attach '${event}' listener to.`);
        }
    };

    // Main page actions
    addSafeEventListener(logoutBtn, 'click', () => signOut(auth));
    addSafeEventListener(addDeviceFab, 'click', () => { resetAddDeviceModal(); toggleModal(addDeviceModal, true); });
    addSafeEventListener(addRoomBtn, 'click', () => toggleModal(addRoomModal, true));
    addSafeEventListener(addRoomForm, 'submit', handleAddRoom);
    
    // Room filter bar
    addSafeEventListener(roomsFilterBar, 'click', (e) => {
        if (e.target.classList.contains('room-filter-btn')) {
            activeRoomFilter = e.target.dataset.room;
            renderRoomFilters();
            renderDevices();
        }
    });

    // Add Device Modal
    if (addDeviceModal) {
        const closeBtn = addDeviceModal.querySelector('.close-modal-btn');
        addSafeEventListener(closeBtn, 'click', () => toggleModal(addDeviceModal, false));
    }
    addSafeEventListener(scanQrBtn, 'click', startQrScanner);
    addSafeEventListener(cancelScanBtn, 'click', () => { stopQrScanner(); goToStep(1); });
    
    addSafeEventListener(manualMacForm, 'submit', (e) => {
        e.preventDefault();
        const macInput = document.getElementById('device-mac-input');
        if (macInput) {
            claimProcessData.macAddress = macInput.value.trim();
            claimProcessData.isVirtual = false;
            if (claimProcessData.macAddress) goToStep(2);
        }
    });

    addSafeEventListener(addVirtualDeviceBtn, 'click', () => {
        claimProcessData.macAddress = 'VIRT:' + Array(5).fill(0).map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();
        claimProcessData.isVirtual = true;
        goToStep(2);
    });

    addSafeEventListener(deviceDetailsForm, 'submit', (e) => {
        e.preventDefault();
        if (deviceNameInput) claimProcessData.deviceName = deviceNameInput.value.trim();
        if (roomSelect) claimProcessData.room = roomSelect.value;
        handleStartClaimProcess();
    });

    if (addDeviceModal) {
        const backBtn = addDeviceModal.querySelector('.back-btn');
        addSafeEventListener(backBtn, 'click', () => goToStep(1));
    }

    addSafeEventListener(copyCodeBtn, 'click', () => {
        if (claimProcessData.claimCode) {
            navigator.clipboard.writeText(claimProcessData.claimCode).then(() => {
                copyCodeBtn.textContent = 'Copied!';
                setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 2000);
            });
        }
    });

    addSafeEventListener(goToVirtualFormBtn, 'click', () => {
        window.open(`form.html?mac=${encodeURIComponent(claimProcessData.macAddress)}&code=${claimProcessData.claimCode}`, '_blank');
        toggleModal(addDeviceModal, false);
    });
    
    // Other Modals
    if (addRoomModal) {
        const closeBtn = addRoomModal.querySelector('.close-modal-btn');
        addSafeEventListener(closeBtn, 'click', () => toggleModal(addRoomModal, false));
    }
    if (confirmDeleteModal) {
        const closeBtn = confirmDeleteModal.querySelector('.close-modal-btn');
        addSafeEventListener(closeBtn, 'click', () => toggleModal(confirmDeleteModal, false));
    }
    addSafeEventListener(cancelDeleteBtn, 'click', () => toggleModal(confirmDeleteModal, false));
    addSafeEventListener(confirmDeleteBtn, 'click', handleDeleteDevice);

    // --- Auth State Observer ---
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
});
