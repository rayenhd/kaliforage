
PYTHON := python3
VENV_DIR := .venv
VENV_PY := $(VENV_DIR)/bin/python

PROJECT_ID ?= kaliforage-e1afb
REGION ?= europe-west9
ARTIFACT_REPO ?= kaliforage
SERVICE_NAME ?= kaliforage
IMAGE_NAME ?= kaliforage-backend
IMAGE_TAG ?= $(shell git rev-parse --short HEAD)
# IMAGE_URI se calcule dynamiquement pour refléter REGION/ARTIFACT_REPO surchargés (QA/preview).
IMAGE_URI = $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(ARTIFACT_REPO)/$(IMAGE_NAME):$(IMAGE_TAG)
SERVICE_ACCOUNT ?=
RUN_FLAGS ?=
SA_FLAG := $(if $(strip $(SERVICE_ACCOUNT)),--service-account $(SERVICE_ACCOUNT),)


venv:
	$(PYTHON) -m venv $(VENV_DIR)


install: venv
	$(VENV_PY) -m pip install --upgrade pip
	$(VENV_PY) -m pip install -r requirements.txt

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


build-image:
	@test -n "$(PROJECT_ID)" || (echo "❌ PROJECT_ID manquant"; exit 1)
	@test -n "$(REGION)" || (echo "❌ REGION manquant"; exit 1)
	@test -n "$(ARTIFACT_REPO)" || (echo "❌ ARTIFACT_REPO manquant"; exit 1)
	@test -n "$(IMAGE_NAME)" || (echo "❌ IMAGE_NAME manquant"; exit 1)
	@echo "🚀 gcloud builds submit --tag $(IMAGE_URI)"
	@gcloud builds submit --project $(PROJECT_ID) --tag $(IMAGE_URI)


deploy-cloudrun:
	@test -n "$(PROJECT_ID)" || (echo "❌ PROJECT_ID manquant"; exit 1)
	@test -n "$(REGION)" || (echo "❌ REGION manquant"; exit 1)
	@test -n "$(SERVICE_NAME)" || (echo "❌ SERVICE_NAME manquant"; exit 1)
	@echo "🚀 gcloud run deploy $(SERVICE_NAME) --image $(IMAGE_URI)"
	@gcloud run deploy $(SERVICE_NAME) \
		--image $(IMAGE_URI) \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		$(SA_FLAG) \
		$(RUN_FLAGS) \
		--project $(PROJECT_ID)
