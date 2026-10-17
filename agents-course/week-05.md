# Week 5. Multi-Agent Systems and Protocols

**Microsoft lessons:** [08 Multi-Agent](https://github.com/microsoft/ai-agents-for-beginners/tree/main/08-multi-agent), [11 Agentic Protocols](https://github.com/microsoft/ai-agents-for-beginners/tree/main/11-agentic-protocols)

**Optional lesson:** [14 Microsoft Agent Framework](https://github.com/microsoft/ai-agents-for-beginners/tree/main/14-microsoft-agent-framework)

## Objectives

After this week, you can:

1. Tell when a multi-agent system is better than a single agent, and when it is not.
2. Name the building blocks of a multi-agent system.
3. Describe three multi-agent patterns: group chat, hand-off, and collaborative filtering.
4. Explain what MCP does and what A2A does, and the difference between them.
5. Explain how NLWeb makes a website available to agents.

## Read and watch

1. Read Lesson 08 and watch its video.
2. Do the two knowledge-check questions at the end of Lesson 08. Then read the solution.
3. Read Lesson 11 and watch its video. Pay attention to the examples for MCP and for A2A.
4. Optional: read Lesson 14. It shows the workflow patterns of Microsoft Agent Framework, for example sequential, concurrent, and hand-off.

## Key ideas

### When to use many agents

Lesson 08 gives three conditions for a multi-agent system:

- **Large workloads.** Many agents can do parts of the work at the same time.
- **Complex tasks.** Each agent does one part of the task.
- **Diverse expertise.** Each agent has its own knowledge and tools.

Lesson 08 also gives three advantages: specialization, scalability, and fault tolerance.

### When one agent is better

The Lesson 08 knowledge check makes this point. A single agent is usually better when one set of instructions and tools can do the task. Many agents add cost, delay, and more places for errors. Use many agents when the roles need different tools, different permissions, or separate audit records.

### The building blocks

Lesson 08 lists six building blocks:

1. Agent communication
2. Coordination mechanisms
3. Agent architecture
4. Visibility into multi-agent interactions
5. Multi-agent patterns
6. Human in the loop

### Three patterns

- **Group chat.** All agents send messages to one shared conversation.
- **Hand-off.** An agent gives the task to the next agent, from rules.
- **Collaborative filtering.** Agents with different expertise give their views. The system combines the views into one recommendation.

### Protocols connect agents to tools and to other agents

**MCP (Model Context Protocol)** connects an agent to tools. An MCP server gives a list of its tools. The agent asks for the list, selects a tool, and calls it. Lesson 11 gives an airline example. The airline operates an MCP server with tools such as "search flights" and "book flights."

**A2A (Agent-to-Agent Protocol)** connects an agent to other agents. The other agents can belong to different companies. Each agent publishes an **agent card** that tells what it can do. In the Lesson 11 example, a travel agent sends tasks to an airline agent, a hotel agent, and a car rental agent.

Use this rule to remember the difference. MCP gives an agent tools. A2A gives an agent colleagues.

**NLWeb** lets people and agents ask a website questions in natural language. Each NLWeb site is also an MCP server, so other agents can use it.

## Discussion 5

Lesson 08 gives a refund process with 15 agents. Is that design realistic for a small or medium company? Name the three agents that a company must have first. Tell which agents a single agent with more tools can replace.

## Assignment 5. One Agent or Many?

**Purpose:** Decide the architecture of the Fall Line agent, and tell where protocols apply.

**Steps:**

1. Decide: one agent, or a multi-agent system. Use the conditions and the knowledge check of Lesson 08. Give your reasons.
2. If you selected many agents, make a table of the agents. For each agent, give its role, its tools, and its permissions.
3. If you selected one agent, name a business change that makes one agent not sufficient. Give one example.
4. Select one pattern from Lesson 08: group chat, hand-off, or collaborative filtering. Tell why it is the best pattern for Fall Line.
5. Name one Fall Line system that can be an MCP server. Name its tools.
6. Tell if Fall Line needs A2A. Give one example in which it does or does not need A2A. Think about the Finance team or an outside payroll company.
7. Tell how a person sees what each agent did. Use the building block "visibility into multi-agent interactions."
8. At the end, write your statement about the AI tools that you used.

**Submit:** A document of 600 to 900 words with a diagram of the architecture, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Architecture decision | The decision uses Lesson 08 and the facts of the case. The memo gives the cost of the decision. | The decision has no reasons, or the reasons are general. | 25 |
| Agents or change trigger | The agent table is complete, or the change trigger is realistic. | The table is not complete, or the trigger is vague. | 15 |
| Pattern | The pattern agrees with the architecture, and the memo tells why the other patterns are worse. | The pattern is given with weak reasons. | 15 |
| MCP and A2A | The memo uses each protocol correctly and does not mix them. | One protocol is used incorrectly. | 25 |
| Visibility | The memo tells what each log record holds and who reads it. | Visibility is mentioned but not specified. | 10 |
| Diagram | The diagram agrees with the text. | The diagram is missing or does not agree with the text. | 10 |

## Optional code path

1. Open the folder `08-multi-agent/code_samples/workflows-agent-framework/python`.
2. Open the notebook that starts with `02.` It shows a sequential workflow.
3. Find the cells that create the agents with `as_agent(`. Write down the role of each agent.
4. Draw the sequence of the agents. Compare it with the hand-off pattern.
5. Optional: open `11-agentic-protocols/code_samples/mcp-agents/README.md`. Read how the server and the client connect.
