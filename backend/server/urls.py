from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import health_check

urlpatterns = [
    path("health", health_check, name="health_root"),
    path("health/", health_check, name="health_slash"),
    path("api/health", health_check, name="api_health"),
    path("api/health/", health_check, name="api_health_slash"),
    path("admin/", admin.site.urls),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/accounts/", include("accounts.urls")),
    path("api/portal/", include("portal.urls")),
    path("api/academics/", include("academics.urls")),
    path("api/finances/", include("finances.urls")),
]
