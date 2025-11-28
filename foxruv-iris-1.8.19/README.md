# 🎯 Iris - AI-Guided LLM Optimization

**Talk to Claude. It handles the rest.**

```
You: "Help me optimize my prompts"

Iris: "I scanned your project. Found 3 AI components.
       Best candidate: summarizer.ts (+20% potential).
       Setting up DSPy... Done.
       Running optimization... 
       
       🎉 Accuracy: 72% → 89%
       
       Want me to apply the changes?"
```

No CLI commands. No config files. No learning curve. Just results.

[![npm version](https://badge.fury.io/js/@foxruv%2Firis.svg)](https://www.npmjs.com/package/@foxruv/iris)

---

## 🚀 Before & After

### ❌ BEFORE: Manual DSPy Optimization

```bash
# Step 1: Install dependencies
pip install dspy-ai ax-platform

# Step 2: Read documentation (50+ pages)
# Step 3: Write training script
cat > optimize.py << 'EOF'
import dspy
from dspy.teleprompt import MIPROv2

# Configure LLM
lm = dspy.OpenAI(model="gpt-4")
dspy.configure(lm=lm)

# Define signature
class Summarize(dspy.Signature):
    text: str = dspy.InputField()
    summary: str = dspy.OutputField()

# Create module
summarizer = dspy.ChainOfThought(Summarize)

# Load training examples (you collected these manually)
trainset = [...]  # Hours of work

# Configure optimizer
optimizer = MIPROv2(
    metric=your_metric_function,
    num_candidates=10,
    init_temperature=1.0
)

# Run optimization
optimized = optimizer.compile(summarizer, trainset=trainset)

# Extract the optimized prompt
print(optimized.dump_state())

# Manually apply to your code...
EOF

python optimize.py

# Step 4: Parse output, understand what changed
# Step 5: Manually update your code
# Step 6: Test and iterate
# Step 7: Remember what worked (you won't)
# Step 8: Repeat for next component
# Step 9: Start from scratch on next project
```

**⏱️ Time: 2-4 hours per component**
**📚 Required: DSPy expertise, Python scripting**
**🧠 Retained: Nothing (starts over each time)**

---

### ✅ AFTER: With Iris

```
You: "Optimize my summarizer"

Iris: "On it."
      
      ✅ Detected TypeScript project
      ✅ Found summarizer.ts  
      ✅ Installing @ts-dspy/core...
      ✅ Scanning for training examples...
      ✅ Running 30-trial optimization...
      ✅ Best result: 89% accuracy (+17%)
      
      "Here's what I changed:
       - Restructured prompt for clarity
       - Added 3 few-shot examples
       - Temperature: 1.0 → 0.7
       
       Apply these changes?"

You: "Yes"

Iris: "Done. Pattern saved for future projects."
```

**⏱️ Time: 30 seconds**
**📚 Required: Nothing**
**🧠 Retained: Everything (learns and improves)**

---

### 📊 Side-by-Side Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BEFORE IRIS              AFTER IRIS              │
├─────────────────────────────────────────────────────────────────────┤
│  Install DSPy/Ax manually          →  Auto-installed               │
│  Write Python scripts              →  Just talk                    │
│  Read 50 pages of docs             →  Zero learning curve          │
│  Collect examples manually         →  Auto-detected                │
│  Configure optimizers              →  Smart defaults               │
│  Parse output yourself             →  Plain English results        │
│  Apply changes manually            →  One-click apply              │
│  Forget what worked                →  Patterns saved forever       │
│  Start over each project           →  Knowledge transfers          │
│  No validation                     →  AI Council approval          │
├─────────────────────────────────────────────────────────────────────┤
│  2-4 hours                         →  30 seconds                   │
│  Expert required                   →  Anyone can do it             │
│  Knowledge lost                    →  Knowledge compounds          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

Just type this into Claude Code:

```
Install @foxruv/iris@latest, find the agent and skill files it created, and follow the steps to help me optimize my AI
```

That's it. Claude installs, reads the agent, and becomes your optimization guide.

**Or manually:**

```bash
npm install @foxruv/iris
```

Then tell Claude: `Read .claude/agents/iris.md and help me optimize`

---

## 🧠 What Iris Handles (So You Don't Have To)

| You Used To... | Now You Just Say... |
|----------------|---------------------|
| `pip install dspy-ai` then write scripts | "Optimize my prompts" |
| `pip install ax-platform` then configure trials | "Find the best temperature" |
| Manually track what worked | "What patterns work best?" |
| Copy settings between projects | "Use what worked before" |
| Read docs for every tool | "Set up local LLM" |
| Write YAML configs | "Configure optimization" |

**Iris installs, configures, runs, and applies. You just approve.**

---

## 🔧 What's Under The Hood

Iris orchestrates powerful tools without you touching them:

### DSPy (Stanford) - Prompt Optimization

```
Without Iris:
  1. pip install dspy-ai
  2. Learn DSPy API
  3. Write training script
  4. Collect examples
  5. Run MIPROv2 optimizer
  6. Parse output
  7. Apply to code

With Iris:
  "Optimize my classifier"
  → Done. +15% accuracy.
```

### Ax (Meta) - Hyperparameter Tuning

```
Without Iris:
  1. pip install ax-platform
  2. Define search space
  3. Configure Bayesian optimization
  4. Run 50+ trials
  5. Analyze results
  6. Apply best params

With Iris:
  "Find the best settings"
  → Done. Temperature 0.7, top_p 0.9.
```

### AgentDB - Learning & Memory

```
Without Iris:
  - Every optimization starts from scratch
  - Repeat same experiments
  - Forget what worked

With Iris:
  - Remembers every optimization
  - "Use what worked on my last project"
  - Patterns compound over time
```

---

## 📈 The Learning Loop

Iris gets smarter the more you use it:

```
Week 1: "Optimize my summarizer"
        → Runs 30 trials, finds best settings
        → Stores pattern: "structured output + temp 0.7 = +17%"

Week 2: "Optimize my classifier" 
        → Recognizes similar task
        → Starts from proven patterns
        → Only 10 trials needed
        → +18% accuracy

Week 3: New project, same task type
        → "Based on your history, I recommend..."
        → 5 trials to confirm
        → Instant optimization
```

**First optimization: 30 trials. Later: 5 trials. Same results.**

---

## 🌐 Federated Learning (Optional)

Share what works across projects and teams:

```
You: "Enable federated learning"

Iris: "Done. Now:
       ✅ Patterns from Project A help Project B
       ✅ Team discoveries benefit everyone
       ✅ Your data stays private (only patterns shared)
       
       Disable anytime with 'turn off federated learning'"
```

**Your whole portfolio gets smarter together.**

---

## 🏛️ AI Council - For High-Stakes Decisions

Before deploying to production, get a second opinion:

```
You: "Deploy my optimized prompt"

Iris: "This goes to 10k requests/day. Let me convene the Council..."

Council: "🏛️ APPROVED (87% confidence)
         
         🧠 PatternMaster: ✅ Matches successful patterns
         ⚖️ PerformanceJudge: ✅ All metrics improved  
         🛡️ SafetyValidator: ⚠️ Add rollback trigger
         
         Recommendation: Deploy to 10% first, monitor 24h"

Iris: "Council approved with safeguards. Deploying..."
```

**6 specialized agents validate your changes before they go live.**

---

## 🏗️ Architecture

```
                         ┌─────────────────────────────────┐
                         │            YOU                  │
                         │   "Optimize my summarizer"      │
                         └───────────────┬─────────────────┘
                                         │
                                         ▼
                         ┌─────────────────────────────────┐
                         │         IRIS AGENT              │
                         │   Understands intent, plans     │
                         └───────────────┬─────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
   │   DSPy (Stanford)   │   │    Ax (Meta)        │   │     AgentDB         │
   │   Prompt Optimizer  │   │  Hyperparameter     │   │   Learning Store    │
   │                     │   │     Tuning          │   │                     │
   │  MIPROv2, COPRO,    │   │  Bayesian search    │   │  Patterns, history  │
   │  BootstrapFewShot   │   │  352x faster        │   │  Cross-project      │
   └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │
                                         ▼
                         ┌─────────────────────────────────┐
                         │        AI COUNCIL               │
                         │   (High-stakes validation)      │
                         │                                 │
                         │  🧠 PatternMaster    (2.0x)     │
                         │  ⚖️ PerformanceJudge (2.0x)     │
                         │  🔬 PromptScientist  (2.0x)     │
                         │  🔄 TransferTester   (1.5x)     │
                         │  🛡️ SafetyValidator  (1.5x)     │
                         │  🎯 Consensus → APPROVE/REJECT  │
                         └───────────────┬─────────────────┘
                                         │
                                         ▼
                         ┌─────────────────────────────────┐
                         │       YOUR CODE                 │
                         │   Optimized & validated         │
                         └─────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                    FEDERATED LEARNING                           │
    │                                                                 │
    │   Project A ◄────────► Supabase ◄────────► Project B           │
    │      │                    │                    │                │
    │   Patterns             Shared              Patterns             │
    │   learned              intelligence        applied              │
    │                                                                 │
    │   "Structured prompts + temp 0.7 = +17% accuracy"              │
    │   → Now available to ALL your projects                         │
    └─────────────────────────────────────────────────────────────────┘
```

---

## 🏠 Local LLM Support

Use Ollama, llama.cpp, or vLLM with automatic cloud fallback:

```
You: "Set up local LLM"

Iris: "I'll configure Ollama with Claude fallback:
       
       ✅ Simple tasks → Local (fast, free, private)
       ✅ Complex tasks → Cloud (better reasoning)
       ✅ Local fails → Automatic cloud fallback
       
       Done. Best of both worlds."
```

---

## 📦 What Gets Installed

After `npm install @foxruv/iris`:

```
.claude/
├── agents/
│   ├── iris/iris.md       ← Your optimization guide
│   └── council/council.md ← 6-agent validation system  
└── skills/
    └── iris/iris.md       ← Detailed commands (for Claude, not you)
```

**Tell Claude to read the agent. It handles everything else.**

---

## 💬 Example Conversations

### Optimize Prompts

```
You: "My summarizer outputs are inconsistent"

Iris: "I'll optimize for consistency. Need 5-10 examples of good outputs.
       [You provide examples]
       
       Running DSPy optimization...
       
       🎉 Consistency improved 40%
       - Added structured output format
       - Lowered temperature to 0.7
       - Added 3 few-shot examples
       
       Apply changes?"
```

### Find Best Settings

```
You: "What temperature should I use?"

Iris: "I'll run Bayesian optimization to find out...
       
       Testing: 0.3, 0.5, 0.7, 0.9, 1.0
       
       Results:
       - Accuracy peaks at 0.7
       - Creativity peaks at 0.9
       - Your task (classification) → 0.7 recommended
       
       Apply temperature 0.7?"
```

### Transfer Knowledge

```
You: "I optimized my summarizer. Will it help my other projects?"

Iris: "Let me check pattern similarity...
       
       ✅ Blog post generator: 78% similar → likely +12% improvement
       ✅ Email writer: 65% similar → likely +8% improvement  
       ⚠️ Code reviewer: 23% similar → probably won't transfer
       
       Apply to blog post generator?"
```

### Production Deployment

```
You: "Deploy to production"

Iris: "This serves 50k requests/day. Running Council validation...
       
       🏛️ Council Decision: APPROVED (with conditions)
       
       Conditions:
       1. Start with 10% traffic
       2. Add rollback if accuracy drops >5%
       3. Monitor 24 hours before full deployment
       
       Proceed with safeguards?"
```

---

## 🛠️ Commands (You Never Run These)

Iris runs these behind the scenes. You just talk.

```bash
# Iris runs these silently:
npx iris discover               # Find optimization targets
npx iris optimize --strategy dspy --target src/summarize.ts
npx iris council analyze        # Validate changes
npx iris federated sync         # Share patterns
npx iris apply --target src/summarize.ts

# You never type these. You just say:
"Optimize my summarizer"
"Validate before deploying"  
"Share patterns with my team"
```

---

## 🎯 Perfect For

- **Solo developers** - Get expert-level optimization without the expertise
- **Teams** - Share what works, stop repeating experiments
- **Production apps** - Council validation before deployment
- **Multiple projects** - Patterns transfer automatically
- **Learning** - Understand what Iris does by asking "show me what you're doing"

---

## 📚 More Resources

- [Quick Start Guide](./IRIS_QUICKSTART.md)
- [Credentials Guide](./CREDENTIALS_GUIDE.md)
- [GitHub](https://github.com/ruvnet/iris)

---

## 🚀 Get Started

Just type this into Claude Code:

```
Install @foxruv/iris@latest, find the agent and skill files it created, and help me optimize my AI
```

Claude handles everything. **Your AI gets better. You just talk.**
