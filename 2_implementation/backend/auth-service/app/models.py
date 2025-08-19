from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref
from app.database import Base
import enum
import sys
import os

# 添加 shared 目錄到 Python 路徑
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))

try:
    from models.user import User as SharedUser
    from models.user_profile import UserProfile as SharedUserProfile
except ImportError:
    # 如果無法導入 shared 模型，使用本地定義
    SharedUser = None
    SharedUserProfile = None


class UserRole(str, enum.Enum):
    student = "student"
    parent = "parent"
    teacher = "teacher"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    
    # Profile information
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    
    # 家長關係（作為家長）
    children = relationship("ParentChildRelation", 
                          foreign_keys="ParentChildRelation.parent_id",
                          back_populates="parent",
                          cascade="all, delete-orphan")
    
    # 子女關係（作為學生）
    parents = relationship("ParentChildRelation", 
                         foreign_keys="ParentChildRelation.child_id",
                         back_populates="child")
    
    # 教師關係
    teaching_classes = relationship("TeacherClassRelation", 
                                  back_populates="teacher",
                                  cascade="all, delete-orphan")
    
    # 學生關係
    student_classes = relationship("StudentClassRelation", 
                                 back_populates="student",
                                 cascade="all, delete-orphan")
    
    def to_dict(self):
        """轉換為字典格式"""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role.value if self.role else None,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "phone": self.phone,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "email_verified_at": self.email_verified_at.isoformat() if self.email_verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


class ParentChildRelation(Base):
    __tablename__ = 'parent_child_relations'

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    child_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    relationship_type = Column(String(50), default='parent')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    parent = relationship("User", foreign_keys=[parent_id], backref="child_relations")
    child = relationship("User", foreign_keys=[child_id], backref="parent_relations")


class SchoolClass(Base):
    """班級表"""
    __tablename__ = "school_classes"
    
    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String(100), nullable=False)  # 例如：7A班、8B班
    grade = Column(String(10), nullable=False)  # 7A, 7B, 8A, 8B, 9A, 9B
    school_year = Column(String(20), nullable=False)  # 例如：2024-2025
    
    # 班級狀態
    is_active = Column(Boolean, default=True)
    
    # 時間戳記
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    teachers = relationship("TeacherClassRelation", back_populates="school_class")
    students = relationship("StudentClassRelation", back_populates="school_class")
    
    def to_dict(self):
        return {
            "id": self.id,
            "class_name": self.class_name,
            "grade": self.grade,
            "school_year": self.school_year,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TeacherClassRelation(Base):
    """教師-班級關係表"""
    __tablename__ = "teacher_class_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    
    # 教學科目
    subject = Column(String(50), nullable=False)  # 數學、國文、英文等
    
    # 關係狀態
    is_active = Column(Boolean, default=True)
    
    # 時間戳記
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    teacher = relationship("User", back_populates="teaching_classes")
    school_class = relationship("SchoolClass", back_populates="teachers")
    
    def to_dict(self):
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "class_id": self.class_id,
            "subject": self.subject,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class StudentClassRelation(Base):
    """學生-班級關係表"""
    __tablename__ = "student_class_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    
    # 學號
    student_number = Column(String(20), nullable=True)
    
    # 關係狀態
    is_active = Column(Boolean, default=True)
    
    # 時間戳記
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    student = relationship("User", back_populates="student_classes")
    school_class = relationship("SchoolClass", back_populates="students")
    
    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "class_id": self.class_id,
            "student_number": self.student_number,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        } 