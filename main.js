// Global variables for storing state
const currentStudents = new Map();
let processingBatch = false;

// Single student check
async function checkSingleStudent() {
    const id = document.getElementById('studentId').value;
    const attendance = Number.parseFloat(document.getElementById('attendance').value);
    const cgpa = Number.parseFloat(document.getElementById('cgpa').value);
    
    if (!validateInput(id, attendance, cgpa)) {
        showResult('single-result', 'Please fill in all fields with valid values', 'error');
        return;
    }

    try {
        // Assert student data
        assertStudent(id, attendance, cgpa, 'SINGLE');
        
        // Check eligibility
        const result = await checkEligibility(id);
        currentStudents.set(id, { attendance, cgpa, result });
        displaySingleResult(result, id, attendance, cgpa);
    } catch (error) {
        showResult('single-result', `Error: ${error.message}`, 'error');
    }
}

// Batch processing
async function processBatch() {
    if (processingBatch) {
        showResult('batch-result', 'Already processing a batch. Please wait...', 'warning');
        return;
    }

    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showResult('batch-result', 'Please select a CSV file', 'error');
        return;
    }

    processingBatch = true;
    const progressBar = document.getElementById('progress-bar');
    const summary = document.getElementById('batch-summary');
    
    try {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const stats = {
                    processed: 0,
                    eligible: 0,
                    permitted: 0,
                    warnings: 0,
                    errors: 0
                };

                // Clear previous batch data
                currentStudents.clear();
                
                for (const row of results.data) {
                    try {
                        const id = row.Student_ID || row.student_id || row.id;
                        const attendance = Number.parseFloat(row.Attendance_percentage || row.attendance);
                        const cgpa = Number.parseFloat(row.CGPA || row.cgpa);

                        if (validateInput(id, attendance, cgpa)) {
                            assertStudent(id, attendance, cgpa, 'BATCH');
                            const result = await checkEligibility(id);
                            
                            // Store results
                            currentStudents.set(id, { attendance, cgpa, result });
                            
                            // Update statistics
                            if (result.scholarship) stats.eligible++;
                            if (result.exam) stats.permitted++;
                            if (result.warning) stats.warnings++;
                            stats.processed++;
                        } else {
                            stats.errors++;
                        }

                        // Update progress bar
                        const percent = (stats.processed / results.data.length) * 100;
                        progressBar.style.width = `${percent}%`;
                        
                    } catch (error) {
                        stats.errors++;
                        console.error("Error processing row:", error);
                    }
                }

                displayBatchSummary(stats, summary);
                await generateReport(); // Automatically generate report after batch processing
                
            },
            error: (error) => {
                showResult('batch-result', `Error parsing CSV: ${error.message}`, 'error');
            }
        });
    } catch (error) {
        showResult('batch-result', `Error: ${error.message}`, 'error');
    } finally {
        processingBatch = false;
    }
}

// Report generation
async function generateReport() {
    const reportType = document.getElementById('report-type').value;
    const table = document.getElementById('report-table');
    const tbody = document.getElementById('report-body');
    
    tbody.innerHTML = ''; // Clear existing rows
    
    try {
        for (const [id, data] of currentStudents) {
            const { attendance, cgpa, result } = data;
            
            // Filter based on report type
            if (shouldIncludeInReport(reportType, result)) {
                const row = createReportRow(id, attendance, cgpa, result);
                tbody.appendChild(row);
            }
        }
        
        table.classList.remove('hidden');
        sortTable(table);
        
    } catch (error) {
        showResult('report-result', `Error generating report: ${error.message}`, 'error');
    }
}

// Helper functions
function validateInput(id, attendance, cgpa) {
    return id && 
           !Number.isNaN(attendance) && attendance >= 0 && attendance <= 100 &&
           !Number.isNaN(cgpa) && cgpa >= 0 && cgpa <= 10;
}

function showResult(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = message;
    element.className = `result ${type}`;
}

function displaySingleResult(result, id, attendance, cgpa) {
    let message = `<h3>Results for Student ID: ${id}</h3>`;
    message += `<p>Attendance: ${attendance}%</p>`;
    message += `<p>CGPA: ${cgpa}</p>`;
    message += `<p>Scholarship Status: <strong>${result.scholarship ? 'Eligible' : 'Not Eligible'}</strong></p>`;
    message += `<p>Exam Permission: <strong>${result.exam ? 'Permitted' : 'Not Permitted'}</strong></p>`;
    
    let statusClass = 'success';
    if (result.critical) {
        message += `<p class="critical">WARNING: Critical attendance level!</p>`;
        statusClass = 'error';
    } else if (result.warning) {
        message += `<p class="warning">Note: Attendance needs improvement</p>`;
        statusClass = 'warning';
    }
    
    showResult('single-result', message, statusClass);
}

function displayBatchSummary(stats, element) {
    const message = `
        <h3>Batch Processing Summary</h3>
        <p>Total Processed: ${stats.processed}</p>
        <p>Scholarship Eligible: ${stats.eligible}</p>
        <p>Exam Permitted: ${stats.permitted}</p>
        <p>Attendance Warnings: ${stats.warnings}</p>
        <p>Processing Errors: ${stats.errors}</p>
    `;
    
    element.innerHTML = message;
}

function shouldIncludeInReport(reportType, result) {
    switch (reportType) {
        case 'scholarship':
            return result.scholarship;
        case 'exam':
            return result.exam;
        case 'warnings':
            return result.warning || result.critical;
        case 'both':
            return true;
        default:
            return false;
    }
}

function createReportRow(id, attendance, cgpa, result) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${id}</td>
        <td>${attendance.toFixed(1)}%</td>
        <td>${cgpa.toFixed(2)}</td>
        <td class="${result.scholarship ? 'success' : 'error'}">${result.scholarship ? '✓' : '✗'}</td>
        <td class="${result.exam ? 'success' : 'error'}">${result.exam ? '✓' : '✗'}</td>
    `;
    
    if (result.critical) {
        row.classList.add('critical-row');
    } else if (result.warning) {
        row.classList.add('warning-row');
    }
    
    return row;
}

function sortTable(table) {
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            sortTableByColumn(table, index);
        });
    });
}

function sortTableByColumn(table, column) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const sortedRows = rows.sort((a, b) => {
        const aCol = a.querySelector(`td:nth-child(${column + 1})`).textContent;
        const bCol = b.querySelector(`td:nth-child(${column + 1})`).textContent;
        return aCol.localeCompare(bCol, undefined, {numeric: true});
    });
    
    tbody.innerHTML = '';
    // biome-ignore lint/complexity/noForEach: <explanation>
    sortedRows.forEach(row => tbody.appendChild(row));
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Add drag and drop support for CSV files
    const dropZone = document.querySelector('.upload-area');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'text/csv') {
            document.getElementById('csvFile').files = e.dataTransfer.files;
            processBatch();
        } else {
            showResult('batch-result', 'Please drop a valid CSV file', 'error');
        }
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            checkSingleStudent();
        }
    });
});

// Export functionality
function exportToCSV() {
    if (currentStudents.size === 0) {
        showResult('report-result', 'No data to export', 'error');
        return;
    }
    
    const rows = [['Student ID', 'Attendance', 'CGPA', 'Scholarship', 'Exam Permission']];
    
    currentStudents.forEach((data, id) => {
        rows.push([
            id,
            data.attendance,
            data.cgpa,
            data.result.scholarship ? 'Yes' : 'No',
            data.result.exam ? 'Yes' : 'No'
        ]);
    });
    
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'eligibility_report.csv');
    a.click();
}