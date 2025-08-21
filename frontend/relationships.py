"""
關係管理 API

提供家長-學生關係和教師-班級關係的管理功能
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from app.database import get_db
from app.models import (
    User, ParentChildRelation, SchoolClass, 
    TeacherClassRelation, StudentClassRelation, UserRole
)
from app.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter(tags=["relationships"])


# Pydantic 模型
class ParentChildRelationCreate(BaseModel):
    child_id: int
    relationship_type: str = "parent"


class ParentChildRelationResponse(BaseModel):
    id: int
    parent_id: int
    child_id: int
    relationship_type: str
    is_active: bool
    parent_name: Optional[str] = None
    child_name: Optional[str] = None


class SchoolClassCreate(BaseModel):
    class_name: str
    grade: str
    school_year: str


class SchoolClassResponse(BaseModel):
    id: int
    class_name: str
    grade: str
    school_year: str
    is_active: bool


class TeacherClassRelationCreate(BaseModel):
    class_id: int
    subject: str


class TeacherClassRelationResponse(BaseModel):
    id: int
    teacher_id: int
    class_id: int
    subject: str
    is_active: bool
    teacher_name: Optional[str] = None
    class_name: Optional[str] = None


# 供教師建立/更新自己班級用
class TeacherCreateClassRequest(BaseModel):
    class_name: str
    subject: str
    grade: Optional[str] = "7"
    school_year: Optional[str] = "2024-2025"


class TeacherUpdateClassRequest(BaseModel):
    class_name: Optional[str] = None
    subject: Optional[str] = None


class StudentClassRelationCreate(BaseModel):
    class_id: int
    student_number: Optional[str] = None


class ClassStudentAdd(BaseModel):
    student_id: int
    student_number: Optional[str] = None


class StudentClassRelationResponse(BaseModel):
    id: int
    student_id: int
    class_id: int
    student_number: Optional[str]
    is_active: bool
    student_name: Optional[str] = None
    class_name: Optional[str] = None


# === 教師管理相關路由（必須在 /classes/* 之前） ===

# 已移除學生管理
@router.get("/teacher-management/removed-students")
async def get_teacher_removed_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """獲取教師的已移除學生列表"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以查看已移除學生"
        )
    
    # 獲取教師所有班級中已移除的學生
    removed_students = []
    
    # 獲取教師的班級關係（包括已刪除的）
    teacher_relations = db.query(TeacherClassRelation).filter(
        TeacherClassRelation.teacher_id == current_user.id
    ).all()
    
    for relation in teacher_relations:
        # 獲取該班級中已移除的學生
        student_relations = db.query(StudentClassRelation).filter(
            and_(
                StudentClassRelation.class_id == relation.class_id,
                StudentClassRelation.is_active == False  # 已移除的學生
            )
        ).all()
        
        for student_relation in student_relations:
            student = db.query(User).filter(User.id == student_relation.student_id).first()
            if student:
                removed_students.append({
                    "student_id": student.id,
                    "student_name": f"{student.first_name} {student.last_name}",
                    "email": student.email,
                    "student_number": student_relation.student_number,
                    "class_name": relation.school_class.class_name if relation.school_class else "未知班級",
                    "is_removed": True,
                    "removed_at": student_relation.updated_at or student_relation.created_at
                })
    
    return {"data": removed_students}


@router.patch("/teacher-management/restore-all-students")
async def restore_all_teacher_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復教師所有已移除的學生"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以恢復學生"
        )
    
    # 獲取教師所有班級中已移除的學生關係
    teacher_relations = db.query(TeacherClassRelation).filter(
        TeacherClassRelation.teacher_id == current_user.id
    ).all()
    
    restored_count = 0
    for relation in teacher_relations:
        student_relations = db.query(StudentClassRelation).filter(
            and_(
                StudentClassRelation.class_id == relation.class_id,
                StudentClassRelation.is_active == False
            )
        ).all()
        
        for student_relation in student_relations:
            student_relation.is_active = True
            restored_count += 1
    
    if restored_count > 0:
        db.commit()
        return {"success": True, "message": f"成功恢復 {restored_count} 個學生"}
    else:
        return {"success": True, "message": "沒有可恢復的學生"}


@router.delete("/teacher-management/clear-all-removed-students")
async def clear_all_teacher_removed_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """清空教師所有已移除的學生（永久刪除）"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以清空已移除學生"
        )
    
    # 獲取教師所有班級中已移除的學生關係
    teacher_relations = db.query(TeacherClassRelation).filter(
        TeacherClassRelation.teacher_id == current_user.id
    ).all()
    
    deleted_count = 0
    for relation in teacher_relations:
        student_relations = db.query(StudentClassRelation).filter(
            and_(
                StudentClassRelation.class_id == relation.class_id,
                StudentClassRelation.is_active == False
            )
        ).all()
        
        for student_relation in student_relations:
            # 軟刪除：將關係設為非活躍
            student_relation.is_active = False
            deleted_count += 1
    
    if deleted_count > 0:
        db.commit()
        return {"success": True, "message": f"成功清空 {deleted_count} 個已移除學生"}
    else:
        return {"success": True, "message": "沒有可清空的已移除學生"}


@router.patch("/teacher-management/restore-student/{relation_id}")
async def restore_teacher_student(
    relation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復教師的已移除學生"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以恢復學生"
        )
    
    # 直接查找學生班級關係記錄
    student_relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.id == relation_id,
            StudentClassRelation.is_active == False
        )
    ).first()
    
    if not student_relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該學生的已移除關係"
        )
    
    # 檢查教師是否有權限操作這個班級
    teacher_relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == student_relation.class_id
        )
    ).first()
    
    if not teacher_relation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無權限操作此班級"
        )
    
    # 獲取學生資訊
    student = db.query(User).filter(User.id == student_relation.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 恢復：將關係設為活躍
    student_relation.is_active = True
    db.commit()
    
    return {"success": True, "message": f"成功恢復學生「{student.first_name} {student.last_name}」"}


@router.delete("/teacher-management/remove-student/{relation_id}")
async def permanently_remove_teacher_student(
    relation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """永久移除教師的學生"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以永久移除學生"
        )
    
    # 直接查找學生班級關係記錄
    student_relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.id == relation_id,
            StudentClassRelation.is_active == True
        )
    ).first()
    
    if not student_relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該學生的班級關係"
        )
    
    # 檢查教師是否有權限操作這個班級
    teacher_relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == student_relation.class_id
        )
    ).first()
    
    if not teacher_relation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無權限操作此班級"
        )
    
    # 獲取學生資訊
    student = db.query(User).filter(User.id == student_relation.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 軟刪除：將關係設為非活躍
    student_relation.is_active = False
    db.commit()
    
    return {"success": True, "message": f"成功永久移除學生「{student.first_name} {student.last_name}」"}


# === 班級學生管理路由 ===

def _ensure_teacher_can_access_class(db: Session, current_user: User, class_id: int):
    """確保教師有權限操作此班級"""
    if current_user.role == UserRole.admin:
        return
    
    bound = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == class_id,
            # 移除 is_active == True 的限制，允許教師操作自己創建的班級（包括已刪除的）
        )
    ).first()
    if not bound:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權限操作此班級")


@router.get("/classes/{class_id}/students", response_model=List[StudentClassRelationResponse])
def list_class_students(
    class_id: int,
    include_removed: bool = Query(False, description="是否包含已移除的學生"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """列出班級學生（教師/Admin 可用）。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)
    
    if include_removed:
        relations = db.query(StudentClassRelation).options(
            joinedload(StudentClassRelation.student),
            joinedload(StudentClassRelation.school_class),
        ).filter(StudentClassRelation.class_id == class_id).all()
    else:
        relations = db.query(StudentClassRelation).options(
            joinedload(StudentClassRelation.student),
            joinedload(StudentClassRelation.school_class),
        ).filter(
            and_(StudentClassRelation.class_id == class_id, StudentClassRelation.is_active == True)
        ).all()
    out: List[StudentClassRelationResponse] = []
    for r in relations:
        out.append(
            StudentClassRelationResponse(
                id=r.id,
                student_id=r.student_id,
                class_id=r.class_id,
                student_number=r.student_number,
                is_active=r.is_active,
                student_name=f"{(r.student.first_name or '')} {(r.student.last_name or '')}".strip() if r.student else None,
                class_name=r.school_class.class_name if r.school_class else None,
            )
        )
    return out


@router.post("/classes/{class_id}/students", response_model=StudentClassRelationResponse)
def add_class_student(
    class_id: int,
    payload: ClassStudentAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """將學生加入班級（教師/Admin）。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)

    # 檢查班級存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    # 檢查學生存在
    student = db.query(User).filter(and_(User.id == payload.student_id, User.role == UserRole.student)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生不存在")

    # 已存在則報錯
    existed = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.student_id == payload.student_id,
            StudentClassRelation.class_id == class_id,
            StudentClassRelation.is_active == True,
        )
    ).first()
    if existed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="學生已在此班級中")

    rel = StudentClassRelation(
        student_id=payload.student_id,
        class_id=class_id,
        student_number=payload.student_number,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return StudentClassRelationResponse(
        id=rel.id,
        student_id=rel.student_id,
        class_id=rel.class_id,
        student_number=rel.student_number,
        is_active=rel.is_active,
        student_name=f"{student.first_name or ''} {student.last_name or ''}".strip(),
        class_name=school_class.class_name,
    )


@router.delete("/classes/{class_id}/students/{student_id}")
def remove_class_student(
    class_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """從班級移除學生（教師/Admin）。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)

    # 檢查班級存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    # 檢查學生存在
    student = db.query(User).filter(and_(User.id == student_id, User.role == UserRole.student)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生不存在")

    # 檢查關係存在
    relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.student_id == student_id,
            StudentClassRelation.class_id == class_id,
            StudentClassRelation.is_active == True,
        )
    ).first()
    if not relation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生不在此班級中")

    # 軟刪除：將關係設為非活躍
    relation.is_active = False
    db.commit()
    return {"success": True, "message": f"成功移除學生「{student.first_name} {student.last_name}」"}


@router.patch("/classes/{class_id}/students/{student_id}/restore")
def restore_class_student(
    class_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復班級學生（教師/Admin）。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)

    # 檢查班級存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    # 檢查學生存在
    student = db.query(User).filter(and_(User.id == student_id, User.role == UserRole.student)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生不存在")

    # 檢查關係存在且已移除
    relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.student_id == student_id,
            StudentClassRelation.class_id == class_id,
            StudentClassRelation.is_active == False,
        )
    ).first()
    if not relation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生關係不存在或未被移除")

    # 恢復：將關係設為活躍
    relation.is_active = True
    db.commit()
    return {"success": True, "message": f"成功恢復學生「{student.first_name} {student.last_name}」"}


# === 學生搜尋路由 ===

@router.get("/students/search")
def search_students(
    kw: str = Query(..., description="搜尋關鍵字（姓名或郵箱）"),
    limit: int = Query(10, description="返回結果數量限制"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """搜尋學生（教師/Admin 可用）。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以搜尋學生"
        )
    
    # 搜尋學生
    students = db.query(User).filter(
        and_(
            User.role == UserRole.student,
            or_(
                User.first_name.ilike(f"%{kw}%"),
                User.last_name.ilike(f"%{kw}%"),
                User.email.ilike(f"%{kw}%")
            )
        )
    ).limit(limit).all()
    
    return [{
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": student.email,
        "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip()
    } for student in students]


# === 家長-學生關係路由 ===

@router.post("/parent-child", response_model=ParentChildRelationResponse)
def create_parent_child_relation(
    payload: ParentChildRelationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立家長-學生關係"""
    if current_user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有家長可以建立家長-學生關係"
        )
    
    # 檢查學生是否存在
    child = db.query(User).filter(
        and_(User.id == payload.child_id, User.role == UserRole.student)
    ).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 檢查關係是否已存在
    existing_relation = db.query(ParentChildRelation).filter(
        and_(
            ParentChildRelation.parent_id == current_user.id,
            ParentChildRelation.child_id == payload.child_id,
            ParentChildRelation.is_active == True
        )
    ).first()
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="家長-學生關係已存在"
        )
    
    # 建立關係
    relation = ParentChildRelation(
        parent_id=current_user.id,
        child_id=payload.child_id,
        relationship_type=payload.relationship_type,
        is_active=True
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    
    return ParentChildRelationResponse(
        id=relation.id,
        parent_id=relation.parent_id,
        child_id=relation.child_id,
        relationship_type=relation.relationship_type,
        is_active=relation.is_active,
        parent_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        child_name=f"{child.first_name or ''} {child.last_name or ''}".strip()
    )


@router.get("/parent-child", response_model=List[ParentChildRelationResponse])
def get_parent_child_relations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """獲取家長-學生關係列表"""
    if current_user.role == UserRole.parent:
        # 家長只能看到自己的關係
        relations = db.query(ParentChildRelation).options(
            joinedload(ParentChildRelation.parent),
            joinedload(ParentChildRelation.child)
        ).filter(
            and_(
                ParentChildRelation.parent_id == current_user.id,
                ParentChildRelation.is_active == True
            )
        ).all()
    elif current_user.role == UserRole.student:
        # 學生只能看到與自己的關係
        relations = db.query(ParentChildRelation).options(
            joinedload(ParentChildRelation.parent),
            joinedload(ParentChildRelation.child)
        ).filter(
            and_(
                ParentChildRelation.child_id == current_user.id,
                ParentChildRelation.is_active == True
            )
        ).all()
    elif current_user.role in [UserRole.teacher, UserRole.admin]:
        # 教師和管理員可以看到所有關係
        relations = db.query(ParentChildRelation).options(
            joinedload(ParentChildRelation.parent),
            joinedload(ParentChildRelation.child)
        ).filter(ParentChildRelation.is_active == True).all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無權限查看家長-學生關係"
        )
    
    return [ParentChildRelationResponse(
        id=relation.id,
        parent_id=relation.parent_id,
        child_id=relation.child_id,
        relationship_type=relation.relationship_type,
        is_active=relation.is_active,
        parent_name=f"{relation.parent.first_name or ''} {relation.parent.last_name or ''}".strip() if relation.parent else None,
        child_name=f"{relation.child.first_name or ''} {relation.child.last_name or ''}".strip() if relation.child else None
    ) for relation in relations]


# === 班級管理路由 ===

@router.post("/classes", response_model=SchoolClassResponse)
def create_school_class(
    payload: SchoolClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立學校班級（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以建立班級"
        )
    
    # 檢查班級名稱是否已存在
    existing_class = db.query(SchoolClass).filter(
        and_(
            SchoolClass.class_name == payload.class_name,
            SchoolClass.grade == payload.grade,
            SchoolClass.school_year == payload.school_year,
            SchoolClass.is_active == True
        )
    ).first()
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="班級名稱已存在"
        )
    
    # 建立班級
    school_class = SchoolClass(
        class_name=payload.class_name,
        grade=payload.grade,
        school_year=payload.school_year,
        is_active=True
    )
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    
    return SchoolClassResponse(
        id=school_class.id,
        class_name=school_class.class_name,
        grade=school_class.grade,
        school_year=school_class.school_year,
        is_active=school_class.is_active
    )


@router.get("/classes", response_model=List[SchoolClassResponse])
def list_school_classes(
    include_deleted: bool = Query(False, description="是否包含已刪除的班級"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """列出學校班級（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以查看班級"
        )
    
    if include_deleted:
        classes = db.query(SchoolClass).all()
    else:
        classes = db.query(SchoolClass).filter(SchoolClass.is_active == True).all()
    
    return [SchoolClassResponse(
        id=c.id,
        class_name=c.class_name,
        grade=c.grade,
        school_year=c.school_year,
        is_active=c.is_active
    ) for c in classes]


# === 教師-班級關係路由 ===

@router.post("/teacher-class", response_model=TeacherClassRelationResponse)
def create_teacher_class_relation(
    payload: TeacherClassRelationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以建立教師-班級關係"
        )
    
    # 檢查班級是否存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == payload.class_id).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="班級不存在"
        )
    
    # 檢查關係是否已存在
    existing_relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == payload.class_id,
            TeacherClassRelation.is_active == True
        )
    ).first()
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="教師-班級關係已存在"
        )
    
    # 建立關係
    relation = TeacherClassRelation(
        teacher_id=current_user.id,
        class_id=payload.class_id,
        subject=payload.subject,
        is_active=True
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    
    return TeacherClassRelationResponse(
        id=relation.id,
        teacher_id=relation.teacher_id,
        class_id=relation.class_id,
        subject=relation.subject,
        is_active=relation.is_active,
        teacher_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        class_name=school_class.class_name
    )


@router.post("/teacher-class/create-class", response_model=TeacherClassRelationResponse)
def create_class_and_relation(
    payload: TeacherCreateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立班級並建立教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以建立班級"
        )
    
    # 檢查班級名稱是否已存在
    existing_class = db.query(SchoolClass).filter(
        and_(
            SchoolClass.class_name == payload.class_name,
            SchoolClass.grade == payload.grade,
            SchoolClass.school_year == payload.school_year,
            SchoolClass.is_active == True
        )
    ).first()
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="班級名稱已存在"
        )
    
    # 建立班級
    school_class = SchoolClass(
        class_name=payload.class_name,
        grade=payload.grade,
        school_year=payload.school_year,
        is_active=True
    )
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    
    # 建立教師-班級關係
    relation = TeacherClassRelation(
        teacher_id=current_user.id,
        class_id=school_class.id,
        subject=payload.subject,
        is_active=True
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    
    return TeacherClassRelationResponse(
        id=relation.id,
        teacher_id=relation.teacher_id,
        class_id=relation.class_id,
        subject=relation.subject,
        is_active=relation.is_active,
        teacher_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        class_name=school_class.class_name
    )


@router.get("/teacher-class", response_model=List[TeacherClassRelationResponse])
def list_teacher_class_relations(
    include_deleted: bool = Query(False, description="是否包含已刪除的關係"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """列出教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以查看教師-班級關係"
        )
    
    if include_deleted:
        relations = db.query(TeacherClassRelation).options(
            joinedload(TeacherClassRelation.school_class)
        ).filter(TeacherClassRelation.teacher_id == current_user.id).all()
    else:
        relations = db.query(TeacherClassRelation).options(
            joinedload(TeacherClassRelation.school_class)
        ).filter(
            and_(
                TeacherClassRelation.teacher_id == current_user.id,
                TeacherClassRelation.is_active == True
            )
        ).all()
    
    return [TeacherClassRelationResponse(
        id=relation.id,
        teacher_id=relation.teacher_id,
        class_id=relation.class_id,
        subject=relation.subject,
        is_active=relation.is_active,
        teacher_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        class_name=relation.school_class.class_name if relation.school_class else None
    ) for relation in relations]


@router.put("/teacher-class/{class_id}", response_model=TeacherClassRelationResponse)
def update_teacher_class_relation(
    class_id: int,
    payload: TeacherUpdateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以更新教師-班級關係"
        )
    
    # 檢查關係是否存在
    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == class_id
        )
    ).first()
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="教師-班級關係不存在"
        )
    
    # 更新班級資訊
    if payload.class_name is not None:
        relation.school_class.class_name = payload.class_name
    if payload.subject is not None:
        relation.subject = payload.subject
    
    db.commit()
    db.refresh(relation)
    
    return TeacherClassRelationResponse(
        id=relation.id,
        teacher_id=relation.teacher_id,
        class_id=relation.class_id,
        subject=relation.subject,
        is_active=relation.is_active,
        teacher_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        class_name=relation.school_class.class_name if relation.school_class else None
    )


@router.delete("/teacher-class/{class_id}")
def delete_teacher_class_relation(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """刪除教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以刪除教師-班級關係"
        )
    
    # 檢查關係是否存在
    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == class_id
        )
    ).first()
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="教師-班級關係不存在"
        )
    
    # 軟刪除：將關係設為非活躍
    relation.is_active = False
    db.commit()
    
    return {"success": True, "message": "教師-班級關係已刪除"}


@router.patch("/teacher-class/{class_id}/restore")
def restore_teacher_class_relation(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復教師-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以恢復教師-班級關係"
        )
    
    # 檢查關係是否存在且已刪除
    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == class_id,
            TeacherClassRelation.is_active == False
        )
    ).first()
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="教師-班級關係不存在或未被刪除"
        )
    
    # 恢復：將關係設為活躍
    relation.is_active = True
    db.commit()
    
    return {"success": True, "message": "教師-班級關係已恢復"}


# === 學生-班級關係路由 ===

@router.post("/student-class", response_model=StudentClassRelationResponse)
def create_student_class_relation(
    payload: StudentClassRelationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立學生-班級關係（教師/Admin）"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以建立學生-班級關係"
        )
    
    # 檢查班級是否存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == payload.class_id).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="班級不存在"
        )
    
    # 檢查學生是否存在
    student = db.query(User).filter(
        and_(User.id == payload.student_id, User.role == UserRole.student)
    ).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 檢查關係是否已存在
    existing_relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.student_id == payload.student_id,
            StudentClassRelation.class_id == payload.class_id,
            StudentClassRelation.is_active == True
        )
    ).first()
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="學生-班級關係已存在"
        )
    
    # 建立關係
    relation = StudentClassRelation(
        student_id=payload.student_id,
        class_id=payload.class_id,
        student_number=payload.student_number,
        is_active=True
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    
    return StudentClassRelationResponse(
        id=relation.id,
        student_id=relation.student_id,
        class_id=relation.class_id,
        student_number=relation.student_number,
        is_active=relation.is_active,
        student_name=f"{student.first_name or ''} {student.last_name or ''}".strip(),
        class_name=school_class.class_name
    ) 