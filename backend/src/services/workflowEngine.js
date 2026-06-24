import pool from '../db.js';
import emailService from './emailService.js';

const WORKFLOW_TYPES = {
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_RESOLVED: 'ticket_resolved'
};

const DEFAULT_WORKFLOWS = [
  {
    name: 'Notifier équipe sur ticket haute priorité',
    trigger: WORKFLOW_TYPES.TICKET_CREATED,
    conditions: [
      { field: 'priority', operator: 'equals', value: 'Haute' }
    ],
    actions: [
      { type: 'send_email', to: 'tech-team@example.com', subject: 'NOUVEAU TICKET HAUTE PRIORITÉ', template: 'high_priority_ticket' }
    ]
  },
  {
    name: 'Ajouter commentaire automatique sur ticket performance',
    trigger: WORKFLOW_TYPES.TICKET_CREATED,
    conditions: [
      { field: 'category', operator: 'equals', value: 'Performance' }
    ],
    actions: [
      { type: 'add_comment', content: 'Merci pour votre ticket. Pour améliorer les performances, essayez de redémarrer votre ordinateur.' }
    ]
  },
  {
    name: 'Notifier utilisateur quand ticket résolu',
    trigger: WORKFLOW_TYPES.TICKET_RESOLVED,
    conditions: [],
    actions: [
      { type: 'send_email_to_creator', subject: 'Votre ticket a été résolu', template: 'ticket_resolved' }
    ]
  }
];

const evaluateCondition = (ticket, condition) => {
  const { field, operator, value } = condition;
  const ticketValue = ticket[field];

  switch (operator) {
    case 'equals':
      return String(ticketValue) === String(value);
    case 'contains':
      return String(ticketValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_equals':
      return String(ticketValue) !== String(value);
    default:
      return false;
  }
};

const evaluateConditions = (ticket, conditions) => {
  if (conditions.length === 0) return true;
  return conditions.every(condition => evaluateCondition(ticket, condition));
};

const executeAction = async (action, ticket, userId = null) => {
  try {
    switch (action.type) {
      case 'send_email':
        await emailService.sendMail({
          to: action.to,
          subject: action.subject,
          text: `Un nouveau ticket a été créé : ${ticket.title}\nDescription : ${ticket.description}\nID : ${ticket.id}`
        });
        break;

      case 'send_email_to_creator':
        const creatorResult = await pool.query('SELECT email FROM users WHERE id = $1', [ticket.created_by]);
        if (creatorResult.rows.length > 0) {
          await emailService.sendMail({
            to: creatorResult.rows[0].email,
            subject: action.subject,
            text: `Votre ticket "${ticket.title}" a été résolu !`
          });
        }
        break;

      case 'add_comment':
        if (userId) {
          await pool.query(
            'INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES ($1, $2, $3, false)',
            [ticket.id, userId, action.content]
          );
        }
        break;

      case 'assign_to_user':
        if (action.user_id) {
          await pool.query(
            'UPDATE tickets SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3',
            [action.user_id, 'Assigné', ticket.id]
          );
        }
        break;

      default:
        console.log(`Action inconnue : ${action.type}`);
    }
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de l\'action :', error);
    return false;
  }
};

const executeWorkflow = async (workflow, ticket, userId = null) => {
  if (!evaluateConditions(ticket, workflow.conditions)) {
    return false;
  }

  console.log(`Exécution du workflow : ${workflow.name}`);
  for (const action of workflow.actions) {
    await executeAction(action, ticket, userId);
  }
  return true;
};

const triggerWorkflows = async (triggerType, ticket, userId = null) => {
  const workflows = [...DEFAULT_WORKFLOWS];

  for (const workflow of workflows) {
    if (workflow.trigger === triggerType) {
      await executeWorkflow(workflow, ticket, userId);
    }
  }
};

export { WORKFLOW_TYPES };
export default {
  triggerWorkflows
};
