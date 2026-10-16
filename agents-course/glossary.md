# Glossary

This glossary gives the meaning of each term that the course uses. Each term has one meaning in all course files. If a Microsoft lesson uses a different word for the same thing, the "Other names" column gives that word.

| Term | Meaning | Other names |
|---|---|---|
| A2A (Agent-to-Agent Protocol) | A standard that lets an agent send tasks to an agent that a different team or company operates. | – |
| agent | A system that uses a model, tools, and knowledge to do a task in steps. The model decides the next step. | AI agent |
| agent card | An A2A document that tells other agents what an agent can do and how to contact it. | – |
| agentic RAG | RAG in which the agent decides what to retrieve, checks the result, and retrieves again when the result is weak. | – |
| approval | A decision by a person to let an agent do one specific action. | human approval |
| assignment | A weekly graded task in this course. | – |
| capstone | The final project of this course. See [capstone.md](capstone.md). | – |
| context | All the information that the model receives in one call: instructions, knowledge, tool results, conversation history, and user preferences. | – |
| context engineering | The work of selecting, compressing, and removing information so that the model has the correct context for the next step. | – |
| context window | The maximum quantity of text that a model can receive in one call. | – |
| evaluation | A test that measures how well an agent does its task. | eval |
| framework | A software library that supplies parts to build agents, such as tool calls and conversation state. | agentic framework, SDK |
| function calling | The method that a model uses to request a tool. The model returns the name of the tool and its arguments. Your code runs the tool. | tool calling |
| guardrail | A rule in code or in instructions that stops an agent from doing an unsafe action. | – |
| hallucination | A statement from a model that is false and that no source supports. | – |
| human-in-the-loop | A design in which a person must give approval before the agent does a high-risk action. | HITL |
| knowledge | Documents and data that an agent uses to give correct answers. | knowledge base |
| maker-checker loop | A loop in which one step makes a result and a second step checks it. If the check fails, the loop makes the result again. | – |
| MCP (Model Context Protocol) | A standard that lets an application connect to a server and use the tools that the server gives. | – |
| memory | Information that an agent keeps for a later step or a later conversation. | – |
| metacognition | The ability of an agent to examine its own results and change its method. | self-reflection |
| model | A large language model (LLM). The model reads the context and writes the next output. | LLM |
| multi-agent system | A system in which two or more agents do parts of one task. | MAS |
| observability | The ability to see each step that an agent did, with its inputs, outputs, time, and cost. | – |
| offline evaluation | An evaluation that uses a fixed test set with known correct answers. | – |
| online evaluation | An evaluation that uses real users and real requests. | – |
| plan | An ordered list of subtasks that leads to a goal. | – |
| prompt injection | An attack in which text tells the agent to ignore its instructions. The text can come from a user, a document, or a tool result. | – |
| RAG (retrieval-augmented generation) | A method that retrieves passages from documents and gives them to the model with the question. | – |
| receipt | A signed record of one agent action. A person can use the signature to find changes to the record. | cryptographic receipt |
| span | One step inside a trace, such as one model call or one tool call. | – |
| structured output | Model output in a fixed format, such as JSON, that code can read. | – |
| system message | The instructions that tell the model its role, its tasks, and its limits. | system prompt |
| tool | Code that an agent can call to get data or to do an action. | function, action |
| tool schema | A description of a tool: its name, its purpose, and its parameters. The model reads the schema to select a tool. | function schema |
| trace | The full record of one agent task from the start to the end. | – |

## Names in the course

| Name | Meaning |
|---|---|
| the Microsoft course | The repository [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners). |
| lesson | One numbered lesson of the Microsoft course, for example Lesson 04. |
| week | One unit of this course, for example Week 2. |
| the Fall Line case | The case in [case-fall-line.md](case-fall-line.md). |
| the Fall Line agent | The agent that students design for the Fall Line case. |
| RAG Lab | The browser simulator at https://wrisvold.github.io/rag-lab/. |
