from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from arenax.domain.errors import InvalidSessionTransition
from arenax.domain.session import Session, SessionStatus, periods_overlap

NOW = datetime(2026, 8, 7, 21, tzinfo=timezone.utc)


def make_session():
    return Session(uuid4(), (uuid4(),), NOW, NOW + timedelta(hours=1))


def test_session_requires_a_space():
    with pytest.raises(ValueError):
        Session(uuid4(), (), NOW, NOW + timedelta(hours=1))


def test_adjacent_half_open_periods_do_not_overlap():
    assert not periods_overlap(NOW, NOW + timedelta(hours=1),
                               NOW + timedelta(hours=1), NOW + timedelta(hours=2))


def test_session_can_start_directly_from_scheduled_and_finish():
    session = make_session()
    session.start(NOW)
    assert session.status is SessionStatus.IN_PROGRESS
    session.finish(NOW + timedelta(hours=1))
    assert session.status is SessionStatus.FINISHED


def test_finished_session_cannot_be_restarted():
    session = make_session()
    session.start(NOW)
    session.finish(NOW + timedelta(hours=1))
    with pytest.raises(InvalidSessionTransition):
        session.start(NOW + timedelta(hours=2))


def test_only_in_progress_session_can_be_extended():
    with pytest.raises(InvalidSessionTransition):
        make_session().extend(NOW + timedelta(hours=2), NOW)


def test_scheduled_session_can_be_confirmed_and_marked_no_show():
    session = make_session()
    session.confirm(NOW)
    assert session.status is SessionStatus.CONFIRMED
    session.mark_no_show(NOW)
    assert session.status is SessionStatus.NO_SHOW
    assert [event.name for event in session.events] == ["SessionConfirmed", "SessionMarkedNoShow"]
