"""
關係管理 API

提供家長-學生關係和教師-班級關係的管理功能
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.database import get_db
from app.models import (
    User, ParentChildRelation, SchoolClass, 
    TeacherClassRelation, StudentClassRelation, UserRole
)
from app.dependencies import get_current_user
from pydantic import BaseModel
from app.schemas import UserResponse # Import UserResponse schema

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


class StudentClassRelationResponse(BaseModel):
    id: int
    student_id: int
    class_id: int
    student_number: Optional[str]
    is_active: bool
    student_name: Optional[str] = None
    class_name: Optional[str] = None



# === 方案B：以班級為資源的學生管理 ===
class ClassStudentAdd(BaseModel):
    student_id: int
    student_number: Optional[str] = None


def _ensure_teacher_can_access_class(db: Session, current_user: User, class_id: int):
    if current_user.role == UserRole.admin:
        return
    if current_user.role != UserRole.teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師或管理員可操作班級學生")
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
    """從班級移除學生（教師/Admin）- 軟刪除。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)
    rel = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.class_id == class_id,
            StudentClassRelation.student_id == student_id,
            StudentClassRelation.is_active == True,
        )
    ).first()
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="學生不在此班級")
    
    # 軟刪除：將關係設為非活躍
    rel.is_active = False
    db.commit()
    return {"success": True}


@router.patch("/classes/{class_id}/students/{student_id}/restore")
def restore_class_student(
    class_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復班級中的已移除學生（教師/Admin）。"""
    _ensure_teacher_can_access_class(db, current_user, class_id)
    rel = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.class_id == class_id,
            StudentClassRelation.student_id == student_id,
            StudentClassRelation.is_active == False,
        )
    ).first()
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該學生的已移除關係")
    
    # 恢復：將關係設為活躍
    rel.is_active = True
    db.commit()
    return {"success": True}


@router.get("/students/search")
def search_students(
    kw: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """簡易學生搜尋（email/姓/名模糊查），教師/Admin 可用。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權限搜尋學生")
    q = db.query(User).filter(
        and_(
            User.role == UserRole.student,
            (
                (User.email.ilike(f"%{kw}%")) |
                (User.first_name.ilike(f"%{kw}%")) |
                (User.last_name.ilike(f"%{kw}%"))
            )
        )
    ).limit(min(50, max(1, limit)))
    rows = q.all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
        }
        for u in rows
    ]



# 家長-學生關係管理
@router.post("/parent-child", response_model=ParentChildRelationResponse)
async def create_parent_child_relation(
    relation_data: ParentChildRelationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """創建家長-學生關係"""
    
    # 檢查權限：只有家長或管理員可以創建關係
    if current_user.role not in [UserRole.parent, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有家長或管理員可以創建親子關係"
        )
    
    # 檢查子女是否存在且為學生
    child = db.query(User).filter(
        and_(User.id == relation_data.child_id, User.role == UserRole.student)
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
            ParentChildRelation.child_id == relation_data.child_id,
            ParentChildRelation.is_active == True
        )
    ).first()
    
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="親子關係已存在"
        )
    
    # 創建關係
    relation = ParentChildRelation(
        parent_id=current_user.id,
        child_id=relation_data.child_id,
        relationship_type=relation_data.relationship_type
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
        parent_name=f"{current_user.first_name} {current_user.last_name}",
        child_name=f"{child.first_name} {child.last_name}"
    )


@router.get("/parent-child", response_model=List[ParentChildDetailResponse])
async def get_parent_child_relations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """獲取家長的子女關係列表，並直接回傳子女詳細資訊"""
    
    if current_user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有家長可以查看親子關係"
        )
    
    relations = db.query(ParentChildRelation).options(
        joinedload(ParentChildRelation.child)
    ).filter(
        ParentChildRelation.parent_id == current_user.id,
        ParentChildRelation.is_active == True
    ).all()
    
    # 直接從載入的 child 關係中提取子女資訊
    children_list = []
    for relation in relations:
        if relation.child:
            children_list.append(
                ParentChildDetailResponse(
                    id=relation.child.id,
                    name=f"{relation.child.first_name or ''} {relation.child.last_name or ''}".strip(),
                    grade=getattr(relation.child, 'grade', None), # Safely access grade
                    class_name=getattr(relation.child, 'class_name', None),
                    avatar=getattr(relation.child, 'avatar_url', None)
                )
            )
    
    return children_list


# 班級管理
@router.post("/classes", response_model=SchoolClassResponse)
async def create_school_class(
    class_data: SchoolClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """創建班級（僅管理員）"""
    
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有管理員可以創建班級"
        )
    
    # 檢查班級是否已存在
    existing_class = db.query(SchoolClass).filter(
        and_(
            SchoolClass.class_name == class_data.class_name,
            SchoolClass.school_year == class_data.school_year
        )
    ).first()
    
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="班級已存在"
        )
    
    school_class = SchoolClass(
        class_name=class_data.class_name,
        grade=class_data.grade,
        school_year=class_data.school_year
    )
    
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    
    return SchoolClassResponse(**school_class.to_dict())


@router.get("/classes", response_model=List[SchoolClassResponse])
async def get_school_classes(
    include_deleted: bool = Query(False, description="是否包含已刪除的班級"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """獲取班級列表"""
    
    if include_deleted:
        classes = db.query(SchoolClass).all()
    else:
        classes = db.query(SchoolClass).filter(SchoolClass.is_active == True).all()
    
    return [SchoolClassResponse(**cls.to_dict()) for cls in classes]


# 教師-班級關係管理
@router.post("/teacher-class", response_model=TeacherClassRelationResponse)
async def create_teacher_class_relation(
    relation_data: TeacherClassRelationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """創建教師-班級關係"""
    
    # 檢查權限：只有教師或管理員可以創建關係
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以創建教學關係"
        )
    
    # 檢查班級是否存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == relation_data.class_id).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="班級不存在"
        )
    
    # 檢查關係是否已存在
    existing_relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.teacher_id == current_user.id,
            TeacherClassRelation.class_id == relation_data.class_id,
            TeacherClassRelation.subject == relation_data.subject,
            TeacherClassRelation.is_active == True
        )
    ).first()
    
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="教學關係已存在"
        )
    
    # 創建關係
    relation = TeacherClassRelation(
        teacher_id=current_user.id,
        class_id=relation_data.class_id,
        subject=relation_data.subject
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
        teacher_name=f"{current_user.first_name} {current_user.last_name}",
        class_name=school_class.class_name
    )


@router.post("/teacher-class/create-class", response_model=TeacherClassRelationResponse)
def teacher_create_class(
    payload: TeacherCreateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """教師一鍵建立班級並綁定教學科目。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師或管理員可建立班級")

    # 建立或取得班級
    school_class = SchoolClass(
        class_name=payload.class_name,
        grade=payload.grade or "7",
        school_year=payload.school_year or "2024-2025",
        is_active=True,
    )
    db.add(school_class)
    db.commit()
    db.refresh(school_class)

    # 建立教學關係
    relation = TeacherClassRelation(
        teacher_id=current_user.id,
        class_id=school_class.id,
        subject=payload.subject,
        is_active=True,
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
        class_name=school_class.class_name,
    )


@router.get("/teacher-class", response_model=List[TeacherClassRelationResponse])
async def get_teacher_class_relations(
    include_deleted: bool = Query(False, description="是否包含已刪除的班級"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """獲取教師的班級關係列表"""
    
    if current_user.role != UserRole.teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師可以查看教學關係"
        )
    
    # 根據 include_deleted 參數決定是否過濾已刪除的關係
    if include_deleted:
        relations = db.query(TeacherClassRelation).options(
            joinedload(TeacherClassRelation.school_class)
        ).filter(
            TeacherClassRelation.teacher_id == current_user.id
        ).all()
    else:
        relations = db.query(TeacherClassRelation).options(
            joinedload(TeacherClassRelation.school_class)
        ).filter(
            and_(
                TeacherClassRelation.teacher_id == current_user.id,
                TeacherClassRelation.is_active == True
            )
        ).all()
    
    return [
        TeacherClassRelationResponse(
            id=relation.id,
            teacher_id=relation.teacher_id,
            class_id=relation.class_id,
            subject=relation.subject,
            is_active=relation.is_active,
            teacher_name=f"{current_user.first_name} {current_user.last_name}",
            class_name=relation.school_class.class_name
        )
        for relation in relations
    ]


@router.put("/teacher-class/{class_id}", response_model=TeacherClassRelationResponse)
def teacher_update_class(
    class_id: int,
    payload: TeacherUpdateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """教師更新自己授課班級的基本資訊或科目。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師或管理員可更新班級")

    # 先確認該班級屬於該教師
    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.class_id == class_id,
            TeacherClassRelation.is_active == True,
            (TeacherClassRelation.teacher_id == current_user.id) if current_user.role == UserRole.teacher else True,
        )
    ).first()
    if not relation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到班級或無權限")

    # 更新班級名稱
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    if payload.class_name is not None:
        school_class.class_name = payload.class_name
    if payload.subject is not None:
        relation.subject = payload.subject

    db.commit()
    db.refresh(school_class)
    db.refresh(relation)

    return TeacherClassRelationResponse(
        id=relation.id,
        teacher_id=relation.teacher_id,
        class_id=relation.class_id,
        subject=relation.subject,
        is_active=relation.is_active,
        teacher_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        class_name=school_class.class_name,
    )


@router.delete("/teacher-class/{class_id}")
def teacher_delete_class(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """教師刪除自己授課班級（軟刪除關係與班級停用）。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師或管理員可刪除班級")

    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.class_id == class_id,
            TeacherClassRelation.is_active == True,
            (TeacherClassRelation.teacher_id == current_user.id) if current_user.role == UserRole.teacher else True,
        )
    ).first()
    if not relation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到班級或無權限")

    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    # 軟刪除：關係失效，班級停用
    relation.is_active = False
    school_class.is_active = False
    db.commit()
    return {"success": True}


@router.patch("/teacher-class/{class_id}/restore")
def teacher_restore_class(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """教師恢復已刪除的班級（重新啟用關係與班級）。"""
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師或管理員可恢復班級")

    # 檢查班級是否存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班級不存在")

    # 檢查是否已被刪除
    if school_class.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="班級未被刪除，無需恢復")

    # 檢查教師是否有權限恢復此班級
    relation = db.query(TeacherClassRelation).filter(
        and_(
            TeacherClassRelation.class_id == class_id,
            TeacherClassRelation.teacher_id == current_user.id,
        )
    ).first()
    
    if not relation and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權限恢復此班級")

    # 恢復班級和關係
    school_class.is_active = True
    if relation:
        relation.is_active = True
    
    db.commit()
    return {"success": True, "message": "班級恢復成功"}


# 學生-班級關係管理
@router.post("/student-class", response_model=StudentClassRelationResponse)
async def create_student_class_relation(
    relation_data: StudentClassRelationCreate,
    student_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """創建學生-班級關係"""
    
    # 確定目標學生ID
    target_student_id = student_id if student_id else current_user.id
    
    # 檢查權限
    if current_user.role == UserRole.student and target_student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="學生只能管理自己的班級關係"
        )
    elif current_user.role not in [UserRole.student, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有學生或管理員可以創建班級關係"
        )
    
    # 檢查班級是否存在
    school_class = db.query(SchoolClass).filter(SchoolClass.id == relation_data.class_id).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="班級不存在"
        )
    
    # 檢查學生是否存在
    student = db.query(User).filter(
        and_(User.id == target_student_id, User.role == UserRole.student)
    ).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 檢查關係是否已存在
    existing_relation = db.query(StudentClassRelation).filter(
        and_(
            StudentClassRelation.student_id == target_student_id,
            StudentClassRelation.class_id == relation_data.class_id,
            StudentClassRelation.is_active == True
        )
    ).first()
    
    if existing_relation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="學生班級關係已存在"
        )
    
    # 創建關係
    relation = StudentClassRelation(
        student_id=target_student_id,
        class_id=relation_data.class_id,
        student_number=relation_data.student_number
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
        student_name=f"{student.first_name} {student.last_name}",
        class_name=school_class.class_name
    )


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


@router.patch("/teacher-management/restore-student/{student_id}")
async def restore_teacher_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢復教師的已移除學生"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以恢復學生"
        )
    
    # 檢查學生是否存在
    student = db.query(User).filter(
        and_(User.id == student_id, User.role == UserRole.student)
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 獲取教師的班級關係
    teacher_relations = db.query(TeacherClassRelation).filter(
        TeacherClassRelation.teacher_id == current_user.id
    ).all()
    
    # 查找該學生在教師班級中的已移除關係
    restored_count = 0
    for relation in teacher_relations:
        student_relation = db.query(StudentClassRelation).filter(
            and_(
                StudentClassRelation.student_id == student_id,
                StudentClassRelation.class_id == relation.class_id,
                StudentClassRelation.is_active == False
            )
        ).first()
        
        if student_relation:
            student_relation.is_active = True
            restored_count += 1
    
    if restored_count > 0:
        db.commit()
        return {"success": True, "message": f"成功恢復學生「{student.first_name} {student.last_name}」"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該學生的已移除關係"
        )


@router.delete("/teacher-management/remove-student/{student_id}")
async def permanently_remove_teacher_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """永久移除教師的學生"""
    
    if current_user.role not in [UserRole.teacher, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有教師或管理員可以永久移除學生"
        )
    
    # 檢查學生是否存在
    student = db.query(User).filter(
        and_(User.id == student_id, User.role == UserRole.student)
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="學生不存在"
        )
    
    # 獲取教師的班級關係
    teacher_relations = db.query(TeacherClassRelation).filter(
        TeacherClassRelation.teacher_id == current_user.id
    ).all()
    
    # 查找該學生在教師班級中的關係
    removed_count = 0
    for relation in teacher_relations:
        student_relation = db.query(StudentClassRelation).filter(
            and_(
                StudentClassRelation.student_id == student_id,
                StudentClassRelation.class_id == relation.class_id
            )
        ).first()
        
        if student_relation:
            # 軟刪除：將關係設為非活躍
            student_relation.is_active = False
            removed_count += 1
    
    if removed_count > 0:
        db.commit()
        return {"success": True, "message": f"成功永久移除學生「{student.first_name} {student.last_name}」"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該學生的關係"
        ) 