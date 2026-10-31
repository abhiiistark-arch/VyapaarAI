from fastapi import APIRouter

from app.api.v1 import ai, analytics, auth, automation, dashboard, google, posts, profile, reviews, system

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(google.router)
api_router.include_router(dashboard.router)
api_router.include_router(analytics.router)
api_router.include_router(reviews.router)
api_router.include_router(posts.router)
api_router.include_router(profile.router)
api_router.include_router(automation.router)
api_router.include_router(ai.router)
api_router.include_router(system.router)
