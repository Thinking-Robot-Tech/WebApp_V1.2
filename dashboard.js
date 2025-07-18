// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore,
    collection,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const logoutBtn = document.getElementById('logout-btn');
    const userEmailDisplay = document.getElementById('user-email');
    const deviceListContainer = document.getElementById('device-list-container');
    const addDeviceBtn = document.getElementById('add-device-btn');
    
    // Add Device Modal
    const addDeviceModal = document.getElementById('add-device-modal');
    const closeAddModalBtn = addDeviceModal.querySelector('.close-modal-btn');
    const claimStep1 = document.getElementById('claim-step-1');
    const claimStep2 = document.getElementById('claim-step-2');
    const startClaimForm = document.getElementById('start-claim-form');
    const deviceHotspotName = document.getElementById('device-hotspot-name');
    const claimCodeDisplay = document.getElementById('claim-code-display');
    const copyCodeBtn = document.getElementById('copy-code-btn');

    // Delete Modal
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteText = document.getElementById('confirm-delete-text');

    // --- Functions ---

    const toggleModal = (modalElement, show) => {
        if (show) {
            modalElement.classList.add('visible');
        } else {
            modalElement.classList.remove('visible');
        }
    };
    
    const resetAddDeviceModal = () => {
        claimStep1.style.display = 'block';
        claimStep2.style.display = 'none';
        startClaimForm.reset();
    };

    const generateClaimCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `PICO-${result}`;
    };

    const handleStartClaimProcess = async (e) => {
        e.preventDefault();
        if (!currentUserId) return;

        const deviceId = document.getElementById('device-id-input').value.trim().toUpperCase();
        if (!deviceId) {
            alert("Please enter a MAC Address.");
            return;
        }

        const claimCode = generateClaimCode();
        const claimRef = doc(db, 'deviceClaims', deviceId);

        try {
            await setDoc(claimRef, {
                ownerId: currentUserId,
                claimCode: claimCode,
                createdAt: serverTimestamp() // For automatic cleanup later
            });

            // Update UI
            claimCodeDisplay.textContent = claimCode;
            const last4Mac = deviceId.slice(-5).replace(/:/g, '');
            deviceHotspotName.textContent = `PICO-Setup-${last4Mac}`;
            claimStep1.style.display = 'none';
            claimStep2.style.display = 'block';

        } catch (error) {
            console.error("Error creating device claim: ", error);
            alert("Could not start the claim process. Please try again.");
        }
    };

    const copyToClipboard = (text) => {
        // Use the modern clipboard API
        navigator.clipboard.writeText(text).then(() => {
            copyCodeBtn.textContent = 'Copied!';
            setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Fallback for older browsers
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                copyCodeBtn.textContent = 'Copied!';
                setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 2000);
            } catch (e) {
                alert("Failed to copy code.");
            }
        });
    };

    const handleToggleDevice = async (deviceId, currentState) => {
        const newState = !currentState;
        const deviceRef = doc(db, 'devices', deviceId);
        const deviceStateRef = doc(db, 'deviceStates', deviceId);
        try {
            await updateDoc(deviceRef, { "state.isOn": newState });
            await updateDoc(deviceStateRef, { isOn: newState });
        } catch (error) {
            console.error("Error toggling device state: ", error);
        }
    };

    const openDeleteConfirmation = (deviceId, deviceName) => {
        confirmDeleteText.textContent = `Are you sure you want to delete "${deviceName}"? This action cannot be undone.`;
        confirmDeleteBtn.dataset.deviceId = deviceId;
        toggleModal(confirmDeleteModal, true);
    };

    const handleDeleteDevice = async () => {
        const deviceId = confirmDeleteBtn.dataset.deviceId;
        if (!deviceId) return;

        try {
            await deleteDoc(doc(db, 'devices', deviceId));
            await deleteDoc(doc(db, 'deviceStates', deviceId));
        } catch (error) {
            console.error("Error deleting device:", error);
            alert("Failed to delete device.");
        } finally {
            toggleModal(confirmDeleteModal, false);
            delete confirmDeleteBtn.dataset.deviceId;
        }
    };

    const getDeviceIcon = (type) => {
        // ... (same as before)
        switch (type) {
            case 'PICO-SOCT':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0-2.2-1.8-4-4-4H9.5A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H14a4 4 0 0 0 4-4Z"/><path d="M8 12h3"/><path d="M15 12h.01"/></svg>`;
            case 'PICO-BLB1':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
            case 'PICO-N01':
            case 'PICO-N02':
            case 'PICO-N03':
            case 'PICO-N04':
            case 'PICO-PWRT':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M11 2v4"/><path d="M11 18v4"/><path d="M4 11H2"/><path d="M22 11h-2"/><path d="M15 2v4"/><path d="M15 18v4"/><path d="M20 15h-4"/><path d="M4 15h4"/><path d="M9 11v-1"/><path d="M15 11v-1"/></svg>`;
            default:
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
        }
    };

    const renderDevices = (devices) => {
        // ... (same as before)
        if (devices.length === 0) {
            deviceListContainer.innerHTML = `<div class="empty-state"><h3>No Devices Yet</h3><p>Click the '+' button to start the claim process.</p></div>`;
            return;
        }
        deviceListContainer.innerHTML = '<div class="device-grid"></div>';
        const grid = deviceListContainer.querySelector('.device-grid');
        devices.forEach(device => {
            const isOnline = device.isOnline || false;
            const card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-icon">${getDeviceIcon(device.type)}</div>
                    <div class="card-status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</div>
                </div>
                <div class="card-main">
                    <h4 class="card-title">${device.name || 'Unnamed Device'}</h4>
                    <p class="card-type">${device.type || 'PICO Device'}</p>
                </div>
                <div class="card-bottom">
                    <button class="delete-btn" aria-label="Delete Device">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                    <label class="switch">
                        <input type="checkbox" class="device-toggle" ${device.state?.isOn ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
            card.querySelector('.device-toggle').addEventListener('change', (e) => {
                handleToggleDevice(device.id, !e.target.checked);
            });
            card.querySelector('.delete-btn').addEventListener('click', () => {
                openDeleteConfirmation(device.id, device.name);
            });
            grid.appendChild(card);
        });
    };

    const fetchAndDisplayDevices = (userId) => {
        // ... (same as before)
        const devicesQuery = query(collection(db, 'devices'), where("ownerId", "==", userId));
        onSnapshot(devicesQuery, (querySnapshot) => {
            if (deviceListContainer.querySelector('.loading-state')) {
                 deviceListContainer.innerHTML = '';
            }
            const devices = [];
            querySnapshot.forEach((doc) => {
                devices.push({ id: doc.id, ...doc.data() });
            });
            renderDevices(devices);
        }, (error) => {
            console.error("Error fetching devices: ", error);
            deviceListContainer.innerHTML = `<p style="color: red; text-align: center;">Error loading devices.</p>`;
        });
    };

    const handleLogout = () => {
        signOut(auth).catch(error => console.error('Logout Error:', error));
    };

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', handleLogout);
    addDeviceBtn.addEventListener('click', () => {
        resetAddDeviceModal();
        toggleModal(addDeviceModal, true);
    });
    closeAddModalBtn.addEventListener('click', () => toggleModal(addDeviceModal, false));
    startClaimForm.addEventListener('submit', handleStartClaimProcess);
    copyCodeBtn.addEventListener('click', () => copyToClipboard(claimCodeDisplay.textContent));
    confirmDeleteBtn.addEventListener('click', handleDeleteDevice);
    cancelDeleteBtn.addEventListener('click', () => toggleModal(confirmDeleteModal, false));

    // --- Auth State Observer ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            if (userEmailDisplay) {
                userEmailDisplay.textContent = user.email;
            }
            fetchAndDisplayDevices(currentUserId);
        } else {
            window.location.href = 'index.html';
        }
    });
});
