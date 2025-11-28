"""
Ax Optimization Service

FastAPI service that exposes Ax Bayesian optimization via HTTP.
Allows TypeScript clients to leverage Ax without direct Python dependencies.

Install:
    pip install ax-platform fastapi uvicorn

Run:
    uvicorn ax_service:app --host 0.0.0.0 --port 8001

Author: FoxRuv
Version: 1.0.0
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from ax.service.ax_client import AxClient
from ax.service.utils.instantiation import ObjectiveProperties
import uvicorn

# ============================================================================
# Pydantic Models
# ============================================================================

class Parameter(BaseModel):
    name: str
    type: str  # 'range', 'choice', 'fixed'
    bounds: Optional[List[float]] = None
    values: Optional[List[Any]] = None
    value: Optional[Any] = None
    log_scale: Optional[bool] = False

class ExperimentRequest(BaseModel):
    name: str
    parameters: List[Parameter]
    objective_name: str = "score"
    minimize: bool = False

class TrialCompletionRequest(BaseModel):
    score: float

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(title="Iris Ax Optimization Service", version="1.0.0")

# Global storage for Ax clients (keyed by experiment_id)
experiments: Dict[str, AxClient] = {}

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Iris Ax Optimization Service",
        "version": "1.0.0",
        "status": "running",
        "active_experiments": len(experiments)
    }

@app.get("/health")
async def health():
    """Health check"""
    try:
        # Verify Ax is working
        test_client = AxClient()
        return {"status": "healthy", "ax_available": True}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

@app.post("/create_experiment")
async def create_experiment(request: ExperimentRequest):
    """
    Create a new Ax experiment
    
    Returns:
        experiment_id: UUID for this experiment
    """
    try:
        # Create Ax client
        client = AxClient()
        
        # Convert parameters to Ax format
        ax_parameters = []
        for param in request.parameters:
            if param.type == 'range':
                ax_parameters.append({
                    "name": param.name,
                    "type": "range",
                    "bounds": param.bounds,
                    "log_scale": param.log_scale or False
                })
            elif param.type == 'choice':
                ax_parameters.append({
                    "name": param.name,
                    "type": "choice",
                    "values": param.values
                })
            elif param.type == 'fixed':
                ax_parameters.append({
                    "name": param.name,
                    "type": "fixed",
                    "value": param.value
                })
        
        # Create experiment
        client.create_experiment(
            name=request.name,
            parameters=ax_parameters,
            objectives={
                request.objective_name: ObjectiveProperties(minimize=request.minimize)
            }
        )
        
        # Store client
        experiment_id = request.name  # Use name as ID for simplicity
        experiments[experiment_id] = client
        
        return {
            "experiment_id": experiment_id,
            "status": "created",
            "parameters": len(ax_parameters)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_next_trial/{experiment_id}")
async def get_next_trial(experiment_id: str):
    """
    Get next trial configuration from Ax
    
    Returns:
        parameters: Dict of parameter values to evaluate
        trial_index: Index of this trial
    """
    if experiment_id not in experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    try:
        client = experiments[experiment_id]
        
        # Get next trial
        parameters, trial_index = client.get_next_trial()
        
        return {
            "parameters": parameters,
            "trial_index": trial_index
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete_trial/{experiment_id}/{trial_index}")
async def complete_trial(
    experiment_id: str,
    trial_index: int,
    completion: TrialCompletionRequest
):
    """
    Report trial results to Ax
    
    Args:
        experiment_id: Experiment ID
        trial_index: Trial index
        completion: Score/outcome
    """
    if experiment_id not in experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    try:
        client = experiments[experiment_id]

        # Complete trial - raw_data must be a dict mapping objective name to value
        # The objective name is "score" (default from create_experiment)
        client.complete_trial(
            trial_index=trial_index,
            raw_data={"score": completion.score}
        )

        return {
            "status": "completed",
            "trial_index": trial_index
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_best/{experiment_id}")
async def get_best(experiment_id: str):
    """
    Get best configuration found so far
    
    Returns:
        parameters: Best parameter configuration
        score: Best score achieved
    """
    if experiment_id not in experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    try:
        client = experiments[experiment_id]
        
        # Get best parameters
        best_parameters, values = client.get_best_parameters()
        
        # Extract score (assuming single objective)
        score = list(values[0].values())[0]
        
        return {
            "parameters": best_parameters,
            "score": score
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_trials/{experiment_id}")
async def get_trials(experiment_id: str):
    """Get all trials for an experiment"""
    if experiment_id not in experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    try:
        client = experiments[experiment_id]
        trials = client.get_trials_data_frame()
        
        return {
            "trials": trials.to_dict('records') if trials is not None else []
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save_checkpoint/{experiment_id}")
async def save_checkpoint(experiment_id: str, filepath: str):
    """Save experiment to JSON checkpoint"""
    if experiment_id not in experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    try:
        client = experiments[experiment_id]
        client.save_to_json_file(filepath=filepath)
        
        return {
            "status": "saved",
            "filepath": filepath
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load_checkpoint")
async def load_checkpoint(filepath: str):
    """Load experiment from JSON checkpoint"""
    try:
        client = AxClient.load_from_json_file(filepath=filepath)
        experiment_id = client.experiment.name
        
        experiments[experiment_id] = client
        
        return {
            "status": "loaded",
            "experiment_id": experiment_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )
