# The Fall Line Case

All weekly assignments and the default capstone use this case. Read it in Week 1. Keep it open while you work.

The Fall Line Supply Company is fictional. Its handbook is the sample document in RAG Lab. The people and the data in this case are also fictional.

## The company

Fall Line Supply Company has three groups of staff:

- Warehouse staff at the warehouse in Milledgeville, Georgia
- Showroom staff at the showroom in Macon, Georgia
- A remote sales team

A People Operations team manages pay, benefits, and leave. A Finance team pays expense claims. An IT team operates the company systems.

## The problem

People Operations gets many questions from staff each week. Most questions are about the handbook:

- "How many vacation days do I get?"
- "How many vacation days do I have now?"
- "Can I work from home on Friday?"
- "How do I get money back for a lunch with a customer?"

The team answers the same questions many times. Staff sometimes wait two days for an answer. Some staff do not read the handbook, and they make requests that break its rules. For example, a person asks for vacation with less than two weeks of notice.

The company wants an AI agent that helps staff with these questions and requests. The course calls this agent **the Fall Line agent**.

## What the Fall Line agent must do

The company gives this first scope:

1. Answer questions about the handbook. Each answer must show the section of the handbook that it comes from.
2. Tell an employee their vacation balance.
3. Help an employee make a vacation request.
4. Help an employee make an expense claim.

The company does not want the agent to approve vacation or pay expense claims. Managers approve vacation. Finance pays expense claims.

## The systems

| System | What it holds | Owner |
|---|---|---|
| Handbook | The employee handbook, as text. RAG Lab has the same text. | People Operations |
| HR system | Each employee's start date, job type, manager, and vacation balance | People Operations |
| Leave system | Vacation requests and their status | People Operations |
| Expense portal | Expense claims, receipts, and their status | Finance |

## Handbook rules that the agent must obey

These rules come from the handbook. The number in brackets is the handbook section.

**Vacation [3.1]**

- A newly hired employee gets 10 vacation days each year.
- An employee with more than three years of service gets 15 vacation days each year.
- A new employee can use vacation after 90 days of service.
- An employee must send a vacation request to their manager at least two weeks before the vacation.
- An employee can move up to five unused days into the next year. The company removes the other unused days.
- Part-time staff get vacation in proportion to their hours.

**Expense reimbursement [4.2]**

- An employee must make the claim through the expense portal within 30 days of the purchase.
- A receipt is necessary for each expense of more than 25 dollars.
- The company adds approved claims to the next regular paycheck.

**Confidential information [5.2]**

- Customer lists, pricing, supplier contracts, and personnel records are confidential.
- Staff must not share them outside the company or keep them on personal devices.

**Use of AI tools [5.3]**

- Staff must not put confidential information, customer data, or personnel records into a public AI tool.
- The person who submits a document is responsible for its accuracy, also when an AI tool helped to write it.

## Starter tools

The Fall Line agent starts with four tools. In Week 2 you write a full schema for each tool, and you can add tools.

| Tool | What it does | Type |
|---|---|---|
| `search_handbook` | Finds the handbook passages that match a question | Read |
| `get_vacation_balance` | Gets the vacation balance of one employee from the HR system | Read, confidential data |
| `submit_vacation_request` | Sends a vacation request to the employee's manager | Write |
| `submit_expense_claim` | Sends an expense claim, with receipts, to the expense portal | Write |

A **read** tool gets data and changes nothing. A **write** tool changes data in a company system. Write tools have a higher risk than read tools.

## The people

| Person | Role in the case |
|---|---|
| Employee | Uses the Fall Line agent |
| Manager | Approves or refuses vacation requests |
| People Operations lead | Owns the handbook and the HR system. Is the business owner of the agent. |
| Finance lead | Owns the expense portal |
| IT lead | Operates the agent and its connections to the systems |

## How the case grows

Each week adds one part to your design of the Fall Line agent:

| Week | What you add |
|---|---|
| 1 | The decision to use an agent, and the agent type |
| 2 | Tool schemas and approval rules |
| 3 | The retrieval loop for handbook questions |
| 4 | A plan for one multi-step request |
| 5 | The decision for one agent or many agents |
| 6 | The context policy and the memory policy |
| 7 | The threat register and the approval matrix |
| 8 | The evaluation plan and the cost limits |

Your capstone brief collects all these parts into one document. You can also use a different organization for the capstone. See [capstone.md](capstone.md).
