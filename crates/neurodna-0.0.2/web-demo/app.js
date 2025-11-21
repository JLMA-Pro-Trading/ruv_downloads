import init, {
    WasmNeuralDNA,
    WasmEvolutionEngine,
    crossover_dna,
    get_default_mutation_policy,
    get_aggressive_mutation_policy,
    get_conservative_mutation_policy,
    PerformanceTimer
} from '../pkg/neural_dna.js';

let wasmReady = false;
let currentDNA = null;
let evolutionEngine = null;
let evolutionInterval = null;
let mutationCount = 0;

// Initialize WASM
async function initializeWasm() {
    try {
        await init();
        wasmReady = true;
        console.log('✅ WASM initialized successfully');
        enableControls();
    } catch (error) {
        showError('Failed to initialize WASM: ' + error.message);
    }
}

// UI Elements
const createBtn = document.getElementById('create-btn');
const evolveBtn = document.getElementById('evolve-btn');
const topologyInput = document.getElementById('topology');
const activationSelect = document.getElementById('activation');
const populationInput = document.getElementById('population');
const mutationRateSlider = document.getElementById('mutation-rate');
const mutationRateDisplay = document.getElementById('mutation-rate-display');

// Update mutation rate display
mutationRateSlider.addEventListener('input', (e) => {
    mutationRateDisplay.textContent = e.target.value + '%';
});

// Create DNA
createBtn.addEventListener('click', createDNA);
evolveBtn.addEventListener('click', toggleEvolution);

function enableControls() {
    createBtn.disabled = false;
    evolveBtn.disabled = false;
}

function createDNA() {
    if (!wasmReady) return;
    
    try {
        const topology = topologyInput.value.split(',').map(n => parseInt(n.trim()));
        const activation = activationSelect.value;
        
        // Validate topology
        if (topology.some(n => isNaN(n) || n <= 0)) {
            throw new Error('Invalid topology. Use positive integers separated by commas.');
        }
        
        // Create random DNA
        currentDNA = WasmNeuralDNA.random(topology, activation);
        currentDNA.set_mutation_rate(mutationRateSlider.value / 100);
        
        // Create evolution engine
        const populationSize = parseInt(populationInput.value);
        const eliteCount = Math.max(1, Math.floor(populationSize * 0.1));
        
        evolutionEngine = new WasmEvolutionEngine(
            populationSize,
            eliteCount,
            topology,
            activation
        );
        
        mutationCount = 0;
        updateDisplay();
        visualizeNetwork(topology);
        
        console.log('✅ Created Neural DNA:', currentDNA.to_json());
    } catch (error) {
        showError('Failed to create DNA: ' + error.message);
    }
}

function toggleEvolution() {
    if (!evolutionEngine) {
        showError('Please create DNA first');
        return;
    }
    
    if (evolutionInterval) {
        // Stop evolution
        clearInterval(evolutionInterval);
        evolutionInterval = null;
        evolveBtn.textContent = 'Start Evolution';
        document.querySelector('.dna-display').classList.remove('evolving');
    } else {
        // Start evolution
        evolveBtn.textContent = 'Stop Evolution';
        document.querySelector('.dna-display').classList.add('evolving');
        
        evolutionInterval = setInterval(() => {
            evolveGeneration();
        }, 100);
    }
}

function evolveGeneration() {
    if (!evolutionEngine) return;
    
    const timer = new PerformanceTimer();
    
    // Evolve one generation
    evolutionEngine.evolve_generation();
    
    // Get best DNA
    const bestDNA = evolutionEngine.get_best_dna();
    if (bestDNA) {
        currentDNA = bestDNA;
        mutationCount++;
    }
    
    // Update display
    updateDisplay();
    updateCharts();
    
    const elapsed = timer.elapsed();
    console.log(`Generation ${evolutionEngine.generation} evolved in ${elapsed.toFixed(2)}ms`);
}

function updateDisplay() {
    if (!currentDNA || !evolutionEngine) return;
    
    // Update statistics
    document.getElementById('generation').textContent = evolutionEngine.generation;
    document.getElementById('fitness').textContent = currentDNA.average_fitness().toFixed(4);
    
    const stats = evolutionEngine.get_statistics();
    if (stats) {
        document.getElementById('diversity').textContent = 
            (stats.population_diversity || 0).toFixed(4);
    }
    
    const topology = currentDNA.topology;
    const neuronCount = topology.reduce((a, b) => a + b, 0);
    const weightCount = currentDNA.weights.length;
    
    document.getElementById('neurons').textContent = neuronCount;
    document.getElementById('weights').textContent = weightCount;
    document.getElementById('mutation-count').textContent = mutationCount;
}

function visualizeNetwork(topology) {
    const container = document.getElementById('network-viz');
    container.innerHTML = '';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '200');
    svg.style.display = 'block';
    
    const width = container.clientWidth;
    const height = 200;
    const layerSpacing = width / (topology.length + 1);
    
    // Draw connections
    for (let l = 0; l < topology.length - 1; l++) {
        const x1 = (l + 1) * layerSpacing;
        const x2 = (l + 2) * layerSpacing;
        
        for (let i = 0; i < topology[l]; i++) {
            const y1 = (i + 1) * (height / (topology[l] + 1));
            
            for (let j = 0; j < topology[l + 1]; j++) {
                const y2 = (j + 1) * (height / (topology[l + 1] + 1));
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#333');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('opacity', '0.5');
                svg.appendChild(line);
            }
        }
    }
    
    // Draw neurons
    for (let l = 0; l < topology.length; l++) {
        const x = (l + 1) * layerSpacing;
        
        for (let i = 0; i < topology[l]; i++) {
            const y = (i + 1) * (height / (topology[l] + 1));
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', l === 0 ? '#00ff88' : 
                                       l === topology.length - 1 ? '#0088ff' : '#888');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            svg.appendChild(circle);
        }
    }
    
    container.appendChild(svg);
}

// Chart management
let fitnessChart = null;
let diversityChart = null;

function initCharts() {
    const fitnessCtx = document.getElementById('fitness-chart').getContext('2d');
    const diversityCtx = document.getElementById('diversity-chart').getContext('2d');
    
    // Simple line drawing for fitness
    fitnessChart = {
        ctx: fitnessCtx,
        data: [],
        maxPoints: 100
    };
    
    // Simple line drawing for diversity
    diversityChart = {
        ctx: diversityCtx,
        data: [],
        maxPoints: 100
    };
}

function updateCharts() {
    if (!evolutionEngine) return;
    
    const fitnessHistory = evolutionEngine.best_fitness_history;
    const diversityHistory = evolutionEngine.diversity_history;
    
    drawChart(fitnessChart, fitnessHistory, '#00ff88');
    drawChart(diversityChart, diversityHistory, '#0088ff');
}

function drawChart(chart, data, color) {
    const ctx = chart.ctx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (data.length < 2) return;
    
    // Get recent data
    const recentData = data.slice(-chart.maxPoints);
    
    // Find min and max for scaling
    const min = Math.min(...recentData);
    const max = Math.max(...recentData);
    const range = max - min || 1;
    
    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Draw data
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    recentData.forEach((value, index) => {
        const x = (index / (recentData.length - 1)) * width;
        const y = height - ((value - min) / range) * height * 0.9 - height * 0.05;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw current value
    if (recentData.length > 0) {
        const lastValue = recentData[recentData.length - 1];
        ctx.fillStyle = color;
        ctx.font = '12px monospace';
        ctx.fillText(lastValue.toFixed(4), width - 60, 20);
    }
}

function showError(message) {
    const container = document.getElementById('error-container');
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = '❌ ' + message;
    container.appendChild(error);
    
    setTimeout(() => {
        error.remove();
    }, 5000);
}

// Initialize
initializeWasm();
initCharts();