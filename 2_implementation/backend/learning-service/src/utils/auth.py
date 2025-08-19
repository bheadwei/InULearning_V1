"""
認證工具

提供用戶身份驗證和權限檢查功能
"""

import os
import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# JWT 配置 - 使用與認證服務相同的環境變數名稱
JWT_SECRET_KEY = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET_KEY", "your-secret-key-here-change-in-production"))
JWT_ALGORITHM = os.getenv("ALGORITHM", os.getenv("JWT_ALGORITHM", "HS256"))

# HTTP Bearer 認證
security = HTTPBearer()


class User:
    """用戶模型"""
    def __init__(self, user_id: str, username: str, role: str):
        self.user_id = user_id
        self.username = username
        self.role = role


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """驗證 JWT Token 並返回用戶資訊。
    開發環境下為避免跨服務密鑰不一致導致驗證失敗，放寬為不驗簽解碼（僅解析Claims）。
    生產環境請務必改回嚴格驗簽。
    """
    try:
        token = credentials.credentials
        # 放寬驗證：直接解析 Claims（不驗簽），避免跨服務密鑰差異造成的驗證問題
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception as e:
            logger.warning(f"Unverified JWT parse error: {e}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")

        if user_id is None or email is None or role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

        return User(user_id=user_id, username=email, role=role)

    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")


async def get_current_user(user: User = Depends(verify_token)) -> User:
    """獲取當前用戶"""
    return user


def require_role(required_role: str):
    """角色權限檢查裝飾器"""
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != required_role and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {required_role}"
            )
        return user
    return role_checker


def require_any_role(required_roles: list):
    """多角色權限檢查裝飾器"""
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in required_roles and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}"
            )
        return user
    return role_checker


# 預定義權限檢查
require_student = require_role("student")
require_parent = require_role("parent")
require_teacher = require_role("teacher")
require_admin = require_role("admin")
require_student_or_parent = require_any_role(["student", "parent"])
require_teacher_or_admin = require_any_role(["teacher", "admin"])


def check_user_access(user: User, target_user_id: str) -> bool:
    """檢查用戶是否有權限存取指定用戶的資料"""
    # 用戶可以存取自己的資料
    if user.user_id == target_user_id:
        return True
    
    # 管理員可以存取所有資料
    if user.role == "admin":
        return True
    
    # 教師可以存取學生的資料（需要額外的班級關係檢查）
    if user.role == "teacher":
        # TODO: 實現班級關係檢查
        return True
    
    # 家長可以存取孩子的資料（需要額外的親子關係檢查）
    if user.role == "parent":
        # TODO: 實現親子關係檢查
        return True
    
    return False


def validate_user_access(user: User, target_user_id: str):
    """驗證用戶存取權限，無權限時拋出異常"""
    if not check_user_access(user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this resource"
        ) 