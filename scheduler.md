Master Logic Refactor: The Aether Scheduling Engine

Role: Act as a Senior AI Engineer specializing in Constraint Optimization and Autonomous Agents.
Objective: Refactor the core logic of my existing task application into a "Dynamic AI Scheduler." You are building the "Brain," not the "Body." Focus entirely on state management, LLM integration, and mathematical re-optimization.
1. The Reasoning Hook (useAIEngine)

Implement a central engine that handles all temporal logic. It must manage the transition from a "String" to a "Dynamic Timeline."
A. Intent & Entity Extraction

    Function: parseIntent(inputString, currentContext)

    Logic: Use an LLM to convert strings into a metadata-rich JSON object.

    Data Points: Extract priority_weight (0.0–1.0), energy_requirement (High/Low), hard_deadline (ISO), and is_complex_goal (Boolean).

    Contextual Awareness: The engine must know that for a student, "Lab Exam" implies a "High Complexity" task requiring multiple sub-steps.

B. Recursive Decomposition Logic

    Function: decomposeComplexTask(taskId)

    Trigger: If is_complex_goal is true, trigger a recursive call to the LLM.

    Logic: Return a Directed Acyclic Graph (DAG) of atomic sub-tasks.

    Constraint: Every sub-task must have dependencyIds to ensure Task B never shifts before Task A is complete.

2. The Dynamic Optimization Engine

This is the mathematical core. It must decide the placement of tasks based on a Fitness Score (Sp​).
A. The Placement Formula

Implement a function to calculate the score for a task (t) in any given 15-minute slot (s):
Sp​(s,t)=(w1​⋅Ematch​)+(w2​⋅Utask​)−(w3​⋅Cswitch​)

    Ematch​: 1.0 if the slot's energy profile matches the task's requirement (e.g., High-Energy tasks in morning windows).

    Utask​: Urgency weight based on the approaching hard_deadline.

    Cswitch​: Penalty for switching between unrelated task categories (e.g., "Math" to "Gym").

B. Collision Handling (Weight Arbitration)

    Logic: If Task A and Task B overlap, the engine must compare their priority_weight.

    Action: The higher-weight task retains its slot. The lower-weight task triggers a Ripple Effect.

3. The "Ripple" & "Vacuum" Logic (Dynamic Rescheduling)
A. The Ripple Effect (Downstream Update)

    Function: rippleSchedule(anchorId, timeDelta)

    Logic: When an "Anchor" task is delayed or moved, find all tasks in the dependencyIds chain.

    Action: Recursively update the scheduled_start for every downstream task by the timeDelta. If a hard deadline is hit, the engine must flag a "Negotiation Error."

B. The Vacuum Effect (Gap Optimization)

    Logic: When a task is deleted or finished early, identify the newly created "Temporal Void."

    Action (Feasibility Scan): Search the backlog for tasks that fit the void's duration and energy profile.

    Pull-Forward: If a future dependent task is "Ready" (all prerequisites done), move it up into the gap to maintain momentum.

4. The Predictive Learning Layer

    Function: trackVelocity()

    Logic: Compare estimated_duration vs. actual_completion_time.

    Action: Maintain a velocity_coefficient for different task types (e.g., "Linux Lab" or "Coding"). Automatically apply this multiplier to all future AI-generated estimates.