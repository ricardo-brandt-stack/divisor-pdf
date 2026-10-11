let selectedFile = null;
const MAX_BYTES = 11 * 1024 * 1024; // Limitador rígido de 11 MB em bytes

// Elementos DOM
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const fileInfoPanel = document.getElementById('file-info-panel');
const infoName = document.getElementById('info-name');
const infoSize = document.getElementById('info-size');
const splitBtn = document.getElementById('split-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultsPanel = document.getElementById('results-panel');
const partsList = document.getElementById('parts-list');

// =========================================================
// 1. GERENCIAMENTO DE TEMA (DARK MODE)
// =========================================================
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeIcon) themeIcon.textContent = '☀️';
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// =========================================================
// 2. SELEÇÃO DE ARQUIVO
// =========================================================
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedFile = file;
    uploadStatus.textContent = `Arquivo carregado: ${file.name}`;
    infoName.textContent = file.name;
    infoSize.textContent = formatBytes(file.size);

    fileInfoPanel.classList.remove('hidden');
    resultsPanel.classList.add('hidden');
    partsList.innerHTML = '';
    splitBtn.disabled = false;
});

// =========================================================
// 3. DIVISÃO INTELIGENTE DE PDF (MÁX 11 MB POR PARTE)
// =========================================================
splitBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    try {
        splitBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        resultsPanel.classList.add('hidden');
        partsList.innerHTML = '';
        updateProgress(5);

        const arrayBuffer = await selectedFile.arrayBuffer();
        const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = srcDoc.getPageCount();

        let currentPartDoc = await PDFLib.PDFDocument.create();
        let partIndex = 1;
        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        const generatedParts = [];

        for (let i = 0; i < totalPages; i++) {
            // Copia a página atual para um documento de teste
            const [copiedPage] = await currentPartDoc.copyPages(srcDoc, [i]);
            currentPartDoc.addPage(copiedPage);

            // Verifica o tamanho estimado do documento atual acumulado
            const testBytes = await currentPartDoc.save();

            // Se exceder 11 MB e já houver mais de uma página, recua e finaliza a parte anterior
            if (testBytes.length > MAX_BYTES && currentPartDoc.getPageCount() > 1) {
                // Remove a última página adicionada
                currentPartDoc.removePage(currentPartDoc.getPageCount() - 1);
                
                // Salva a parte válida
                const finalBytes = await currentPartDoc.save();
                const partName = `${baseName}_Parte${partIndex}.pdf`;
                generatedParts.push({ name: partName, bytes: finalBytes });

                // Inicia uma nova parte com a página que excedeu o limite
                partIndex++;
                currentPartDoc = await PDFLib.PDFDocument.create();
                const [newPage] = await currentPartDoc.copyPages(srcDoc, [i]);
                currentPartDoc.addPage(newPage);
            }

            const percent = Math.round(((i + 1) / totalPages) * 100);
            updateProgress(percent);
        }

        // Salva a última parte restante
        if (currentPartDoc.getPageCount() > 0) {
            const finalBytes = await currentPartDoc.save();
            const partName = `${baseName}_Parte${partIndex}.pdf`;
            generatedParts.push({ name: partName, bytes: finalBytes });
        }

        // Renderiza lista de partes para download
        renderResults(generatedParts);
        splitBtn.disabled = false;

    } catch (err) {
        console.error('Erro ao dividir PDF:', err);
        alert('Ocorreu um erro ao processar o documento PDF.');
        splitBtn.disabled = false;
    }
});

function renderResults(parts) {
    resultsPanel.classList.remove('hidden');
    partsList.innerHTML = '';

    parts.forEach(part => {
        const li = document.createElement('li');
        const blob = new Blob([part.bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        li.innerHTML = `
            <div>
                <strong>${part.name}</strong>
                <span style="display: block; font-size: 0.75rem; color: var(--text-secondary);">
                    Tamanho: ${formatBytes(part.bytes.length)}
                </span>
            </div>
            <a href="${url}" download="${part.name}" class="btn-download-part">Baixar</a>
        `;

        partsList.appendChild(li);
    });

    resultsPanel.scrollIntoView({ behavior: 'smooth' });
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}