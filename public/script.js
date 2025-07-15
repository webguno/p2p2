class P2PFileSharing {
    constructor() {
        this.ws = null;
        this.connectionId = null;
        this.roomId = null;
        this.role = null; // 'sender' or 'receiver'
        this.currentFile = null;
        this.fileChunks = [];
        this.receivedChunks = new Map();
        this.chunkSize = 32768; // 32KB chunks
        
        this.initializeElements();
        this.attachEventListeners();
        this.connectWebSocket();
        this.checkUrlParams();
    }

    initializeElements() {
        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        
        // Sections
        this.modeSection = document.getElementById('modeSection');
        this.sendSection = document.getElementById('sendSection');
        this.receiveSection = document.getElementById('receiveSection');
        this.transferSection = document.getElementById('transferSection');
        
        // Buttons
        this.sendBtn = document.getElementById('sendBtn');
        this.receiveBtn = document.getElementById('receiveBtn');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        this.acceptBtn = document.getElementById('acceptBtn');
        this.rejectBtn = document.getElementById('rejectBtn');
        this.backBtn = document.getElementById('backBtn');
        
        // Inputs
        this.fileInput = document.getElementById('fileInput');
        this.roomCodeInput = document.getElementById('roomCodeInput');
        
        // Display elements
        this.roomInfo = document.getElementById('roomInfo');
        this.roomCode = document.getElementById('roomCode');
        this.qrCode = document.getElementById('qrCode');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.transferFileName = document.getElementById('transferFileName');
        this.transferFileSize = document.getElementById('transferFileSize');
        this.transferActions = document.getElementById('transferActions');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.toastContainer = document.getElementById('toastContainer');
    }

    attachEventListeners() {
        this.sendBtn.addEventListener('click', () => this.showSendSection());
        this.receiveBtn.addEventListener('click', () => this.showReceiveSection());
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        this.acceptBtn.addEventListener('click', () => this.acceptFile());
        this.rejectBtn.addEventListener('click', () => this.rejectFile());
        this.backBtn.addEventListener('click', () => this.goBack());
        
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // Handle Enter key in room code input
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateStatus('Connected', 'connected');
            this.showToast('Connected to server', 'success');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            this.updateStatus('Disconnected', 'error');
            this.showToast('Connection lost', 'error');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            this.updateStatus('Connection Error', 'error');
            this.showToast('Connection error', 'error');
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'connection':
                this.connectionId = data.connectionId;
                break;
            case 'room-created':
                this.handleRoomCreated(data);
                break;
            case 'room-joined':
                this.handleRoomJoined(data);
                break;
            case 'peer-joined':
                this.handlePeerJoined(data);
                break;
            case 'peer-disconnected':
                this.handlePeerDisconnected();
                break;
            case 'file-offer':
                this.handleFileOffer(data);
                break;
            case 'file-answer':
                this.handleFileAnswer(data);
                break;
            case 'file-chunk':
                this.handleFileChunk(data);
                break;
            case 'file-complete':
                this.handleFileComplete(data);
                break;
            case 'file-error':
                this.handleFileError(data);
                break;
            case 'error':
                this.showToast(data.message, 'error');
                break;
        }
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            this.roomCodeInput.value = roomParam.toUpperCase();
            this.showReceiveSection();
        }
    }

    showSendSection() {
        this.hideAllSections();
        this.sendSection.classList.remove('hidden');
        this.backBtn.classList.remove('hidden');
        this.role = 'sender';
    }

    showReceiveSection() {
        this.hideAllSections();
        this.receiveSection.classList.remove('hidden');
        this.backBtn.classList.remove('hidden');
        this.role = 'receiver';
    }

    showTransferSection() {
        this.hideAllSections();
        this.transferSection.classList.remove('hidden');
        this.backBtn.classList.remove('hidden');
    }

    hideAllSections() {
        this.modeSection.classList.add('hidden');
        this.sendSection.classList.add('hidden');
        this.receiveSection.classList.add('hidden');
        this.transferSection.classList.add('hidden');
    }

    goBack() {
        this.hideAllSections();
        this.modeSection.classList.remove('hidden');
        this.backBtn.classList.add('hidden');
        this.roomInfo.classList.add('hidden');
        this.fileInfo.classList.add('hidden');
        this.transferActions.classList.add('hidden');
        this.resetProgress();
        this.role = null;
        this.roomId = null;
        this.currentFile = null;
        this.fileChunks = [];
        this.receivedChunks.clear();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.currentFile = file;
            this.fileName.textContent = file.name;
            this.fileSize.textContent = this.formatFileSize(file.size);
            this.fileInfo.classList.remove('hidden');
            this.createRoomBtn.disabled = false;
        }
    }

    createRoom() {
        if (!this.currentFile) {
            this.showToast('Please select a file first', 'warning');
            return;
        }
        
        this.createRoomBtn.disabled = true;
        this.send({
            type: 'create-room'
        });
    }

    joinRoom() {
        const roomCode = this.roomCodeInput.value.trim();
        if (!roomCode) {
            this.showToast('Please enter a room code', 'warning');
            return;
        }
        
        this.joinRoomBtn.disabled = true;
        this.send({
            type: 'join-room',
            roomId: roomCode
        });
    }

    handleRoomCreated(data) {
        this.roomId = data.roomId;
        this.roomCode.textContent = data.roomId;
        this.roomInfo.classList.remove('hidden');
        this.updateStatus('Waiting for receiver...', 'connected');
        this.generateQRCode(data.roomId);
        this.showToast('Room created successfully', 'success');
    }

    handleRoomJoined(data) {
        this.roomId = data.roomId;
        this.updateStatus('Connected to room', 'connected');
        this.showToast('Joined room successfully', 'success');
        this.joinRoomBtn.disabled = false;
    }

    handlePeerJoined(data) {
        this.updateStatus('Receiver connected', 'connected');
        this.showToast('Receiver joined the room', 'success');
        this.startFileSending();
    }

    handlePeerDisconnected() {
        this.updateStatus('Peer disconnected', 'error');
        this.showToast('The other user disconnected', 'error');
        setTimeout(() => this.goBack(), 3000);
    }

    async generateQRCode(roomId) {
        try {
            const response = await fetch(`/api/qr/${roomId}`);
            const data = await response.json();
            this.qrCode.innerHTML = `<img src="${data.qrCode}" alt="QR Code" />`;
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.qrCode.innerHTML = '<p>QR code unavailable</p>';
        }
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomId).then(() => {
            this.showToast('Room code copied!', 'success');
        }).catch(() => {
            this.showToast('Failed to copy room code', 'error');
        });
    }

    startFileSending() {
        if (!this.currentFile) return;
        
        this.showTransferSection();
        this.transferFileName.textContent = this.currentFile.name;
        this.transferFileSize.textContent = this.formatFileSize(this.currentFile.size);
        this.updateStatus('Sending file offer...', 'connected');
        
        // Send file offer
        this.send({
            type: 'file-offer',
            fileName: this.currentFile.name,
            fileSize: this.currentFile.size,
            fileType: this.currentFile.type
        });
    }

    handleFileOffer(data) {
        this.showTransferSection();
        this.transferFileName.textContent = data.fileName;
        this.transferFileSize.textContent = this.formatFileSize(data.fileSize);
        this.transferActions.classList.remove('hidden');
        this.updateStatus('File offer received', 'connected');
        this.showToast(`File offer: ${data.fileName}`, 'success');
    }

    acceptFile() {
        this.transferActions.classList.add('hidden');
        this.updateStatus('Accepting file...', 'connected');
        this.send({
            type: 'file-answer',
            accepted: true
        });
    }

    rejectFile() {
        this.send({
            type: 'file-answer',
            accepted: false
        });
        this.showToast('File rejected', 'warning');
        setTimeout(() => this.goBack(), 2000);
    }

    handleFileAnswer(data) {
        if (data.accepted) {
            this.updateStatus('File accepted - Starting transfer...', 'connected');
            this.showToast('File accepted by receiver', 'success');
            this.sendFileChunks();
        } else {
            this.updateStatus('File rejected', 'error');
            this.showToast('File was rejected', 'error');
            setTimeout(() => this.goBack(), 2000);
        }
    }

    async sendFileChunks() {
        if (!this.currentFile) return;
        
        const totalChunks = Math.ceil(this.currentFile.size / this.chunkSize);
        this.updateStatus('Sending file...', 'connected');
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, this.currentFile.size);
            const chunk = this.currentFile.slice(start, end);
            
            try {
                const base64Chunk = await this.fileToBase64(chunk);
                this.send({
                    type: 'file-chunk',
                    chunk: base64Chunk,
                    chunkIndex: i,
                    totalChunks: totalChunks
                });
                
                // Update progress
                const progress = ((i + 1) / totalChunks) * 100;
                this.updateProgress(progress);
                
                // Small delay to prevent overwhelming the connection
                await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error) {
                this.send({
                    type: 'file-error',
                    error: 'Failed to process file chunk'
                });
                return;
            }
        }
        
        this.send({
            type: 'file-complete',
            success: true
        });
    }

    handleFileChunk(data) {
        this.receivedChunks.set(data.chunkIndex, data.chunk);
        
        // Update progress
        const progress = (this.receivedChunks.size / data.totalChunks) * 100;
        this.updateProgress(progress);
        this.updateStatus(`Receiving file... ${Math.round(progress)}%`, 'connected');
        
        // Check if all chunks received
        if (this.receivedChunks.size === data.totalChunks) {
            this.assembleFile(data.totalChunks);
        }
    }

    assembleFile(totalChunks) {
        try {
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const chunk = this.receivedChunks.get(i);
                if (!chunk) {
                    throw new Error(`Missing chunk ${i}`);
                }
                chunks.push(this.base64ToBlob(chunk));
            }
            
            const file = new Blob(chunks);
            this.downloadFile(file, this.transferFileName.textContent);
            
            this.send({
                type: 'file-complete',
                success: true
            });
        } catch (error) {
            this.send({
                type: 'file-error',
                error: 'Failed to assemble file'
            });
        }
    }

    handleFileComplete(data) {
        if (data.success) {
            this.updateStatus('Transfer completed successfully!', 'connected');
            this.showToast('File transfer completed!', 'success');
            this.updateProgress(100);
        } else {
            this.updateStatus('Transfer failed', 'error');
            this.showToast('File transfer failed', 'error');
        }
        
        setTimeout(() => this.goBack(), 3000);
    }

    handleFileError(data) {
        this.updateStatus('Transfer error', 'error');
        this.showToast(`Transfer error: ${data.error}`, 'error');
        setTimeout(() => this.goBack(), 3000);
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    base64ToBlob(base64) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray]);
    }

    updateStatus(text, status = 'connected') {
        this.statusText.textContent = text;
        const dot = this.statusIndicator.querySelector('.status-dot');
        dot.className = `status-dot ${status}`;
    }

    updateProgress(percentage) {
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${Math.round(percentage)}%`;
    }

    resetProgress() {
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new P2PFileSharing();
});
