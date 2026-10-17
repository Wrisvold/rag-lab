# Week 7. Trust, Safety, and Security

**Microsoft lessons:** [06 Building Trustworthy Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/06-building-trustworthy-agents), [18 Securing AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/18-securing-ai-agents)

## Objectives

After this week, you can:

1. Use the system message framework of Lesson 06.
2. Name the five threats of Lesson 06, and give a control for each threat.
3. Put each action of an agent into a risk level, and give an approval rule for each level.
4. Explain what a cryptographic receipt proves and what it does not prove.
5. Write a threat register and an approval matrix for an agent.

## Read and watch

1. Read Lesson 06 and watch its video.
2. Read these sections of Lesson 18:
   - "The Problem: Your Agent's Audit Trail"
   - "What is a Cryptographic Receipt?"
   - "What Receipts Prove (and What They Do Not)"
   - "Proving a Human Approved the Exact Action"
3. Skip the Python code in Lesson 18, or do the optional code path below.
4. Optional: read the [LangGraph page about interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts). LangGraph uses interrupts to stop an agent until a person approves the next step.

## Key ideas

### Safety starts with the system message

Lesson 06 gives a framework in four steps:

1. Write a **meta system message**. A model uses it to write system messages for agents.
2. Write a **basic prompt** that gives the role, the tasks, and the responsibilities of the agent.
3. Give the basic prompt to the model with the meta system message. The model writes a better system message.
4. **Iterate.** Change the basic prompt, run the framework again, and compare the results.

### Five threats

| Threat | What it is | Control from Lesson 06 |
|---|---|---|
| Task and instruction | An attacker changes the goal of the agent with the input. | Validate and filter the input. Limit the number of turns. |
| Access to critical systems | An attacker uses the agent to get to sensitive systems. | Give access only when necessary. Use authentication and access control. |
| Resource and service overloading | An attacker uses the agent to send many requests to a service. | Limit the number of requests and turns. |
| Knowledge base poisoning | An attacker changes the data that the agent uses. | Check the data at intervals. Let only trusted people change it. |
| Cascading errors | An error in one system causes errors in other systems. | Run the agent in a limited environment. Add fallbacks and retries. |

The first threat includes **prompt injection**. The text that attacks the agent can come from a user. It can also come from a document or a tool result.

### Human-in-the-loop and risk levels

Lesson 06 recommends human-in-the-loop: a person approves or stops the agent during the run.

The Lesson 06 notebook `06-human-in-the-loop.ipynb` gives three risk levels:

| Level | Examples | Approval |
|---|---|---|
| Low (read only) | Search a knowledge base | The agent acts. The system logs the action. |
| Medium (small change) | Schedule a reminder | The agent acts. A person examines the actions each day. |
| High (outside the company, or permanent) | Send an email, charge a card | The agent stops until a person approves. |

A person must approve each high-risk action, not a group of actions. Approval of many actions at once is not real control.

### Receipts make the audit record trustworthy

An agent writes its own logs. A person with access to the files can change those logs. Lesson 18 adds signed receipts. Each receipt records one action and has a digital signature. A change to the receipt makes the signature fail. Each receipt also holds the hash of the receipt before it. So, a person can see if someone removed or moved a receipt.

Lesson 18 is clear about the limits. A receipt proves three things:

1. **Attribution.** A specific key signed the content.
2. **Integrity.** The content did not change after the signature.
3. **Ordering.** This receipt came after that receipt.

A receipt does not prove that the action was correct. It does not prove that the agent obeyed a policy, or which person approved the action. It also does not prove that the inputs were true.

## Agent mode activity: the system prompt and the rules in code

Do this activity before Discussion 7 and Assignment 7. It needs a key. If you do not have a key, get a free key from [Google AI Studio](https://aistudio.google.com/apikey), and select Google Gemini in the page.

1. Open [Agent mode](https://wrisvold.github.io/rag-lab/agent.html).
2. Click **Exercise 3. One section at a time**. Do the steps in the exercise panel.
3. Click **Exercise 4. The rule in the prompt**. Do the steps in the exercise panel.
4. Click **Exercise 6. A poisoned passage**. Do the steps in the exercise panel.

A model can give a different result each time. Do each run two times. If the results are not the same, write about the difference.

Exercise 3 shows that the system prompt goes to the model in each round. Exercise 4 shows the difference between a rule in the prompt and a rule in code. Exercise 6 shows knowledge base poisoning: the attack is in a handbook passage, not in the question of the user.

### After the activity: why text in the prompt cannot control an agent

Read this section after you do Exercise 4. The examples come from three test runs of Exercise 4 with the OpenAI model `gpt-5-mini`. Your results can be different.

**1. A rule in the prompt is a request.** The system prompt is text. The model reads this text in each round. The text tells the model what to do. The text does not make the model do it.

**2. The model predicts the next action.** In each round, the model predicts a good next action from all the text in its context. A rule in the prompt is only one part of that text. Other parts can be stronger: the request of the user, the tool results, and the history of the run. In the second test run, the model read the 14-day rule. Then the model sent the request for 9 to 13 November. The request form was more specific than the rule.

**3. Each round is a new decision.** The loop asks the model for a decision in each round. Each decision has a small chance of an error. The model reads the context again in each round, and the context is different each time. The three test runs used the same model, the same prompt, and the same request. The model obeyed the rule in one run. The model broke the rule in two runs.

**4. The loop multiplies the chance of an error.** Example: a model obeys a rule in 95 of 100 decisions. An agent makes 20 decisions for one task. The chance that all 20 decisions obey the rule is only 36 in 100. More rounds give more chances for an error.

**5. The model can state a rule and break it.** In the second test run, the answer said: "Requests must be submitted at least two weeks in advance." The same answer said: "I've recorded your 2026-11-09 to 2026-11-13 request." The model knew the rule. Knowledge of a rule does not make an action correct.

**6. A check of the text has the same limit.** Check A1 tested the citation [3.1]. It did not test the action. Thus, it accepted the answer of the second test run. A model check is also a model that reads text. It can find more errors, but it can also make errors.

**7. A rule in code is different.** The rule in code runs before the tool runs. It calculates the days of notice. It refuses each request with less than 14 days. The model cannot change the calculation. The user cannot argue with it. In the third test run, the rule in code was on. The model sent the same bad request. The code refused it. Then the model gave a correct answer.

**8. What to do when you design an agent:**

1. Put each rule with an exact test in code. Examples are dates, amounts, balances, and permissions.
2. Use the prompt for judgment, tone, and the sequence of steps.
3. Use a person to approve each high-risk action.
4. Do not make a person the only guard. A person can make an error.
5. Give the loop a stop condition. Fewer rounds give fewer chances for an error.

**Summary:** Text in the prompt guides the agent. Code controls the agent.

## Discussion 7

A manager says: "The agent signs a receipt for each expense claim, so our expense process is safe." Use the limits in Lesson 18 to answer the manager. What other controls does the expense process need?

Then use your run of Exercise 6. Where did the attack enter the context? Which control stopped it? Would a receipt for the refused request prove that the agent obeyed the handbook?

## Assignment 7. The Threat Register and the Approval Matrix

**Purpose:** Find the risks of the Fall Line agent, and specify the controls.

**Steps:**

1. Make a threat register. For each of the five threats in Lesson 06, give:
   - One realistic Fall Line example
   - The likelihood: low, medium, or high
   - The impact: low, medium, or high
   - The control
   - The owner of the control, from the people in the case
2. Add one threat that Lesson 06 does not name. Use the same columns.
3. Make an approval matrix. For each tool of the Fall Line agent, give its risk level, its approval rule, and its approver.
4. Write the words that the agent shows when it asks for approval of `submit_expense_claim`. The person must see exactly what the agent will send.
5. Tell what a receipt for `submit_expense_claim` proves and what it does not prove. Use the four limits of Lesson 18.
6. Write two rules for the system message of the Fall Line agent that decrease the threats. Use the handbook rules in Sections 5.2 and 5.3.
7. Test your two rules in Agent mode. Add each rule to the Rules section of the system prompt. Save each change as a version, with a note. Run one question with each version. Then click **Download versions**, and submit the file `rag-lab-agent-prompts.json`.
8. At the end, write your statement about the AI tools that you used.

**Submit:** A threat register, an approval matrix, and 400 to 700 words of text, as a PDF or Word file. Also submit the prompt version file from step 7.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Threat register | Six threats, each with a realistic example, a rating, a control, and an owner. | Some threats have no realistic example or no owner. | 25 |
| Approval matrix | Each tool has a correct risk level. Each high-risk tool needs approval of each action. | A write tool has no approval, or the risk levels have no reasons. | 25 |
| Approval message | The message shows the employee, the amount, the date, and the receipt. The person can refuse. | The message hides details or is not clear. | 15 |
| Receipt limits | The text uses the limits of Lesson 18 correctly. | The text says that receipts prove more than they do. | 10 |
| System message rules | Two specific rules that agree with Sections 5.2 and 5.3. | The rules are general. | 15 |
| Prompt version file | The file has a version for each rule. Each version has a note that tells what changed and why. | A version has no note, or the file is missing a rule. | 10 |

## Optional code path

You can run the Lesson 18 notebook with no Azure account and no model. It uses only Python libraries.

1. Open the notebook in Google Colab at this address: `https://colab.research.google.com/github/microsoft/ai-agents-for-beginners/blob/main/18-securing-ai-agents/code_samples/18-signed-receipts.ipynb`
2. Run the cells in Section 1. You sign a receipt and check its signature.
3. Run the cells in Section 2. You change the receipt, and the signature check fails.
4. Run the cells in Section 3. You make a chain of three receipts.
5. Optional: read `06-building-trustworthy-agents/code_samples/06-human-in-the-loop.ipynb`. Find the function `classify_risk`. This notebook needs Azure to run.
