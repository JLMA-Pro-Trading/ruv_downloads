#!/bin/bash
# Tab completion script for Claude-Flow Neural CLI
# Source this file to enable tab completion: source neural_completion.bash

_claude_flow_neural_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main command options
    if [ ${#COMP_WORDS[@]} -eq 2 ]; then
        opts="neural benchmark simulate optimize report"
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
    
    # Neural subcommands
    if [ "${COMP_WORDS[1]}" = "neural" ] && [ ${#COMP_WORDS[@]} -eq 3 ]; then
        opts="forecast train evaluate backtest deploy monitor optimize"
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
    
    # Handle neural subcommand options
    case "${COMP_WORDS[1]}-${COMP_WORDS[2]}" in
        neural-forecast)
            case "${prev}" in
                --model|-m)
                    COMPREPLY=( $(compgen -W "nhits nbeats tft patchtst auto" -- ${cur}) )
                    return 0
                    ;;
                --format|-f)
                    COMPREPLY=( $(compgen -W "json csv text" -- ${cur}) )
                    return 0
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --horizon|-h|--confidence|-c)
                    # No completion for numeric values
                    return 0
                    ;;
                *)
                    # Check if we need a symbol argument
                    local has_symbol=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]]; then
                            has_symbol=1
                            break
                        fi
                    done
                    
                    if [ $has_symbol -eq 0 ]; then
                        # Provide common stock symbols
                        COMPREPLY=( $(compgen -W "AAPL TSLA GOOGL MSFT AMZN NVDA META BTC-USD ETH-USD" -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--horizon --model --gpu --confidence --output --format --plot" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
            
        neural-train)
            case "${prev}" in
                --model|-m)
                    COMPREPLY=( $(compgen -W "nhits nbeats tft patchtst" -- ${cur}) )
                    return 0
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --epochs|-e|--batch-size|-b|--learning-rate|-lr|--validation-split|-v)
                    # No completion for numeric values
                    return 0
                    ;;
                *)
                    # Check if we need a dataset argument
                    local has_dataset=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]] && [[ "$word" =~ \.(csv|json)$ ]]; then
                            has_dataset=1
                            break
                        fi
                    done
                    
                    if [ $has_dataset -eq 0 ]; then
                        # Complete CSV files
                        COMPREPLY=( $(compgen -f -X '!*.csv' -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--model --epochs --batch-size --learning-rate --validation-split --gpu --output --early-stopping" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
            
        neural-evaluate)
            case "${prev}" in
                --test-data|-t)
                    COMPREPLY=( $(compgen -f -X '!*.csv' -- ${cur}) )
                    return 0
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --format|-f)
                    COMPREPLY=( $(compgen -W "json csv text" -- ${cur}) )
                    return 0
                    ;;
                --metrics|-m)
                    COMPREPLY=( $(compgen -W "mae mape rmse smape mse r2" -- ${cur}) )
                    return 0
                    ;;
                *)
                    # Check if we need a model argument
                    local has_model=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]] && [[ "$word" =~ \.json$ ]]; then
                            has_model=1
                            break
                        fi
                    done
                    
                    if [ $has_model -eq 0 ]; then
                        # Complete JSON files
                        COMPREPLY=( $(compgen -f -X '!*.json' -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--test-data --metrics --output --format" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
            
        neural-backtest)
            case "${prev}" in
                --symbol|-s)
                    COMPREPLY=( $(compgen -W "AAPL TSLA GOOGL MSFT AMZN NVDA META BTC-USD ETH-USD" -- ${cur}) )
                    return 0
                    ;;
                --start|--end)
                    # Provide some example dates
                    COMPREPLY=( $(compgen -W "2024-01-01 2024-06-01 2024-12-31" -- ${cur}) )
                    return 0
                    ;;
                --strategy)
                    COMPREPLY=( $(compgen -W "buy_hold momentum mean_reversion trend_following" -- ${cur}) )
                    return 0
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --initial-capital|-c)
                    # No completion for numeric values
                    return 0
                    ;;
                *)
                    # Check if we need a model argument
                    local has_model=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]] && [[ "$word" =~ \.json$ ]]; then
                            has_model=1
                            break
                        fi
                    done
                    
                    if [ $has_model -eq 0 ]; then
                        # Complete JSON files
                        COMPREPLY=( $(compgen -f -X '!*.json' -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--symbol --start --end --strategy --initial-capital --output --plot" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
            
        neural-deploy)
            case "${prev}" in
                --env|-e)
                    COMPREPLY=( $(compgen -W "development staging production" -- ${cur}) )
                    return 0
                    ;;
                --traffic|-t|--rollback-threshold)
                    # No completion for numeric values
                    return 0
                    ;;
                *)
                    # Check if we need a model argument
                    local has_model=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]] && [[ "$word" =~ \.json$ ]]; then
                            has_model=1
                            break
                        fi
                    done
                    
                    if [ $has_model -eq 0 ]; then
                        # Complete JSON files
                        COMPREPLY=( $(compgen -f -X '!*.json' -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--env --traffic --health-check --rollback-threshold" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
            
        neural-monitor)
            case "${prev}" in
                --env|-e)
                    COMPREPLY=( $(compgen -W "development staging production all" -- ${cur}) )
                    return 0
                    ;;
                --refresh|-r)
                    # Provide common refresh intervals
                    COMPREPLY=( $(compgen -W "5 10 30 60 120" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "--dashboard --env --refresh --alerts" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;
            
        neural-optimize)
            case "${prev}" in
                --metric|-m)
                    COMPREPLY=( $(compgen -W "mae mape rmse sharpe" -- ${cur}) )
                    return 0
                    ;;
                --output|-o)
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --trials|-t|--timeout)
                    # No completion for numeric values
                    return 0
                    ;;
                *)
                    # Check if we need a model argument
                    local has_model=0
                    for word in "${COMP_WORDS[@]:3}"; do
                        if [[ ! "$word" =~ ^- ]] && [[ "$word" =~ \.json$ ]]; then
                            has_model=1
                            break
                        fi
                    done
                    
                    if [ $has_model -eq 0 ]; then
                        # Complete JSON files
                        COMPREPLY=( $(compgen -f -X '!*.json' -- ${cur}) )
                    else
                        # Provide options
                        COMPREPLY=( $(compgen -W "--trials --metric --gpu --output --timeout" -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;
    esac
    
    # Default fallback
    COMPREPLY=( $(compgen -f -- ${cur}) )
}

# Register completion function
complete -F _claude_flow_neural_completion claude-flow
complete -F _claude_flow_neural_completion ./claude-flow
complete -F _claude_flow_neural_completion claude-flow-neural
complete -F _claude_flow_neural_completion ./claude-flow-neural

# Completion for benchmark CLI as well
complete -F _claude_flow_neural_completion benchmark-cli
complete -F _claude_flow_neural_completion ./benchmark/cli.py

echo "Claude-Flow Neural CLI tab completion enabled"
echo "Available commands:"
echo "  claude-flow neural forecast <symbol> [options]"
echo "  claude-flow neural train <dataset> [options]"
echo "  claude-flow neural evaluate <model> [options]"
echo "  claude-flow neural backtest <model> [options]"
echo "  claude-flow neural deploy <model> [options]"
echo "  claude-flow neural monitor [options]"
echo "  claude-flow neural optimize <model> [options]"