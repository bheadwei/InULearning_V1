from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, ARRAY
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False, default='student')
    
class LearningSession(Base):
    __tablename__ = 'learning_sessions'
    id = Column(String, primary_key=True) # Assuming UUID is stored as string
    user_id = Column(Integer, ForeignKey('users.id'))
    subject = Column(String, nullable=False)
    accuracy_rate = Column(Float)
    time_spent = Column(Integer)
    start_time = Column(DateTime, default=datetime.utcnow)
    question_count = Column(Integer, default=10)
    
class UserLearningProfile(Base):
    __tablename__ = 'user_learning_profiles'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    overall_accuracy = Column(Float, default=0)
    total_practice_time = Column(Integer, default=0)
    total_sessions = Column(Integer, default=0)

class ExerciseRecord(Base):
    __tablename__ = 'exercise_records'
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    is_correct = Column(Boolean, nullable=False)
    knowledge_points = Column(ARRAY(Text))
