# Week 2. Tools and Function Calling

**Microsoft lesson:** [04 Tool Use](https://github.com/microsoft/ai-agents-for-beginners/tree/main/04-tool-use)

## Objectives

After this week, you can:

1. Explain the tool use design pattern.
2. Describe the four steps of one tool call, from the user request to the final answer.
3. Write a tool schema that a model can read and that a manager can approve.
4. Classify a tool as read or write, and give it an approval rule.
5. Explain how a read-only connection to a database decreases risk.

## Read and watch

1. Read Lesson 04 and watch its video.
2. Read the section "Function/Tool Calling" two times. Follow the example of `get_current_time` step by step. You do not need to understand each line of code.
3. Read the section "What are the special considerations for using the Tool Use Design Pattern to build trustworthy AI agents?"
4. Read the section "Tools from an MCP server." You study MCP in Week 5.

## Key ideas

### A tool is code that the agent can call

Lesson 04 says that a tool is code that an agent can run to do actions. A tool can be a calculator, a database query, or a call to a service.

### One tool call has four steps

The model does not run the tool. Your code runs the tool. The sequence is:

1. Your code sends the user request and the tool schemas to the model.
2. The model returns a **tool call**: the name of a tool and its arguments. It does not return the answer yet.
3. Your code runs the tool and sends the result back to the model.
4. The model writes the final answer from the tool result.

This sequence is important for governance. Your code is between the model and each action. Your code can check, refuse, or log each tool call.

### The schema is the contract

The model selects a tool from its schema. A schema has a name, a description, and parameters. A weak description causes wrong tool calls. Lesson 10 gives this advice when tool calls fail: "Refine the defined parameters, prompts, and naming of tools."

Write each tool description for two readers:

- The model, which must select the correct tool.
- The manager, who must approve what the tool can do.

### Approval rules

The Lesson 04 notebook marks some tools with `approval_mode="never_require"`. The agent can call these tools with no approval. It marks the tool `book_flight` with `approval_mode="always_require"`. A person must approve each call to that tool.

Use this rule as a start: a read tool can run with no approval. A write tool needs approval until you have evidence that it is safe.

### Limit the permissions of each tool

Lesson 04 discusses a database tool that writes SQL. The risk is that the model writes a query that changes or deletes data. The lesson gives this control: give the agent a read-only role in the database. The database then refuses all changes, whatever the model writes.

This is a general rule. Put the control in the system that the tool connects to, not only in the instructions to the model.

## Optional Agent mode activity: compare the schemas

Do this activity after you write the schemas of Assignment 2. It needs no key.

1. Open [Agent mode](https://wrisvold.github.io/rag-lab/agent.html).
2. Under **Tools**, click **Schema** for each of the three tools. Read the name, the description, and the parameters.
3. Compare each schema with your schema. Record one difference in a description and one difference in the parameters.
4. Under **Rules in code**, read the three rules of `submit_vacation_request`. Each rule gives a handbook section.
5. Optional, if you have a key: click **Exercise 4. The rule in the prompt**. Do the steps until the approval panel opens.

The page puts the notice, service, and balance rules in code. The model cannot ignore a rule in code. This is the general rule of this week: put the control in the system that the tool connects to.

## Discussion 2

Lesson 04 says that a read-only database role controls the risk of SQL that a model writes. Is this control sufficient for the Fall Line HR system? Think about confidential personnel records. What other control does the HR system need?

## Assignment 2. The Tool Specification

**Purpose:** Specify the tools of the Fall Line agent so that a developer can build them and a manager can approve them.

**Steps:**

1. Start with the four starter tools in the [case](case-fall-line.md). Add one or two tools if your design needs them.
2. For each tool, write a schema with these fields:
   - Name
   - Description for the model, in 25 words or fewer
   - Parameters, with the type and the meaning of each parameter
   - Output
3. For each tool, give its type: read, read with confidential data, or write.
4. For each tool, give its approval rule: no approval, or approval by a named person.
5. For each tool, name one handbook rule that the tool must check. Give the section number.
6. Choose one tool. Write the four steps of one call to it, as in the key ideas above. Use a real Fall Line request.
7. At the end, write your statement about the AI tools that you used.

**Submit:** A tool table and the sequence for one tool call, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Schemas | Each tool has all four fields. A developer can build the tool from the schema. | Some fields are missing or vague. | 30 |
| Descriptions | Each description tells the model when to use the tool and when not to use it. | The descriptions only repeat the tool name. | 15 |
| Types and approval rules | Each write tool needs approval. The memo gives reasons for each rule. | Some rules are missing, or a write tool runs with no approval and no reason. | 20 |
| Handbook rules | Each tool checks a correct rule, with the section number. | Some rules are wrong or have no section number. | 15 |
| Sequence of one tool call | The four steps are correct, and the example uses Fall Line data. | One step is missing or in the wrong sequence. | 20 |

## Optional code path

You do not need an Azure account to read the notebook. You need one to run it.

1. Open `04-tool-use/code_samples/04-python-agent-framework.ipynb`.
2. Find the three tools with `approval_mode="never_require"`. Write down their names.
3. Find the tool `book_flight`. Compare its approval mode with the other tools.
4. Find the section "Structured Output with Tools." Read the class `TravelPlan`. You use structured output again in Week 4.
5. If you have an Azure account, follow Lesson 00 and run the notebook.
