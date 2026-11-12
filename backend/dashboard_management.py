"""Actor-based lead management, independent of the lead's present owner/board."""
import unicodedata
from collections import defaultdict

import models


def normalized(value):
    return ' '.join(''.join(char for char in unicodedata.normalize('NFKD', str(value or '').lower())
                           if not unicodedata.combining(char)).replace('_', ' ').split())


def canonical_status(value):
    key = normalized(value)
    return {
        'nuevo': 'new', 'nuevos': 'new', 'contactado': 'contacted', 'contactados': 'contacted',
        'interested': 'in_process', 'en proceso': 'in_process', 'in process': 'in_process',
        'credit application': 'credit_study', 'credit study': 'credit_study', 'estudio de credito': 'credit_study',
        'aprobaciones': 'approvals', 'reservado': 'reserved', 'reserva': 'reserved',
        'alistamiento': 'preparation', 'vendido': 'sold', 'vendidos': 'sold',
        'perdido': 'lost', 'perdidos': 'lost', 'descartado': 'discarded', 'descartados': 'discarded',
        'deleted': 'discarded', 'eliminado': 'discarded',
    }.get(key, key.replace(' ', '_'))


def human_management(entry):
    if not entry.user_id or not entry.previous_status:
        return False
    comment = normalized(entry.comment)
    # The transfer that follows marking a lead lost is system work, not a
    # second employee action, even though legacy history retains its actor ID.
    if any(marker in comment for marker in (
        '[auto alert]', 'lead reasignado automaticamente', 'transferido automaticamente',
        'trasladado automaticamente', 'asignado automaticamente',
    )):
        return False
    if normalized(entry.previous_status) in {'creation', 'creacion'} or comment.startswith(('lead creado', 'lead creada')):
        return False
    return True


def management_metrics(db, company_id, start, end, actor_ids=None, bucket=None):
    """Count unique leads per destination; repeated visits do not inflate cards.

    Stream scalar rows, not ORM lead graphs. Date filtering occurs in SQL and
    includes soft-deleted/reassigned leads. Hard-purged history cannot be rebuilt.
    """
    query = db.query(models.LeadHistory.user_id, models.LeadHistory.lead_id,
                     models.LeadHistory.previous_status, models.LeadHistory.new_status,
                     models.LeadHistory.comment, models.LeadHistory.created_at,
                     models.Lead.status, models.Lead.deleted_at, models.Lead.source).join(
        models.Lead, models.Lead.id == models.LeadHistory.lead_id
    ).filter(models.Lead.company_id == company_id,
             models.LeadHistory.created_at >= start, models.LeadHistory.created_at < end,
             models.LeadHistory.user_id.isnot(None))
    if actor_ids is not None:
        query = query.filter(models.LeadHistory.user_id.in_(actor_ids))
    destinations = defaultdict(set)
    managed = {}
    daily = defaultdict(set)
    sources = {}
    actions = 0
    for entry in query.yield_per(500):
        if not human_management(entry):
            continue
        actions += 1
        managed[entry.lead_id] = 'discarded' if entry.deleted_at else canonical_status(entry.status)
        sources[entry.lead_id] = entry.source or 'sin_fuente'
        if bucket:
            daily[bucket(entry.created_at)].add(entry.lead_id)
        previous = canonical_status(entry.previous_status)
        target = canonical_status(entry.new_status)
        # Legacy soft deletions intentionally kept previous_status == new_status.
        if normalized(entry.comment).startswith('lead eliminado del tablero'):
            target = 'discarded'
        if target and target != previous:
            destinations[target].add(entry.lead_id)
    current = defaultdict(int)
    for status in managed.values():
        current[status or 'new'] += 1
    source_counts = defaultdict(int)
    for source in sources.values():
        source_counts[source] += 1
    return {
        'management_actions_total': actions,
        'management_leads_total': len(managed),
        'management_transition_distribution': {status: len(ids) for status, ids in destinations.items()},
        'management_current_distribution': dict(current),
        'management_leads_by_day': {day: len(ids) for day, ids in daily.items()},
        'management_source_distribution': dict(source_counts),
    }
