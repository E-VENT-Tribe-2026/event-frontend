# Feature: AI Event Assistant Frontend Module


<!-- toc -->

- [1. Feature Context](#1-feature-context)
  - [1.1 Overview](#11-overview)
  - [1.2 Purpose](#12-purpose)
  - [1.3 Actors](#13-actors)
  - [1.4 References](#14-references)
- [2. Actor Flows (CDSL)](#2-actor-flows-cdsl)
  - [Conversational Chat & Thread Lifecycle](#conversational-chat--thread-lifecycle)
  - [Interactive Event Search & Spotlight Cards](#interactive-event-search--spotlight-cards)
  - [Draft Preview, Direct Publish & Creator Form Sync](#draft-preview-direct-publish--creator-form-sync)
- [3. Processes / Business Logic (CDSL)](#3-processes--business-logic-cdsl)
  - [Assistant API Client & Structured Card Extraction](#assistant-api-client--structured-card-extraction)
  - [XSS-Safe Markdown Parsing & Rendering](#xss-safe-markdown-parsing--rendering)
- [4. States (CDSL)](#4-states-cdsl)
  - [Assistant Widget Interaction State Machine](#assistant-widget-interaction-state-machine)
- [5. Definitions of Done](#5-definitions-of-done)
  - [AI Assistant Frontend Traceability & Implementation](#ai-assistant-frontend-traceability--implementation)
- [6. Acceptance Criteria](#6-acceptance-criteria)

<!-- /toc -->

- [x] `p1` - **ID**: `cpt-eventfrontend-featstatus-ai-assistant`
## 1. Feature Context

### 1.1 Overview

End-to-end frontend AI Event Assistant module providing conversational event discovery, rich event result and spotlight cards, XSS-safe markdown rendering, interactive event drafting, one-click draft publishing, and live synchronization with the Create Event form.

### 1.2 Purpose

Empower signed-in users to discover events and draft or publish new events through natural language conversation while maintaining strict account isolation and full DESIGN traceability.

**Principles**: `cpt-eventfrontend-principle-account-isolation`, `cpt-eventfrontend-principle-structured-cards`

### 1.3 Actors

| Actor | Role in Feature |
|-------|-----------------|
| Signed-in User / Organizer | Signed-in attendee or organizer interacting with the AI assistant chat widget and event creator |

### 1.4 References

- **Design**: [docs/agent-tool-specification.md](../../docs/agent-tool-specification.md)
- **Dependencies**: None

## 2. Actor Flows (CDSL)

### Conversational Chat & Thread Lifecycle

- [x] `p1` - **ID**: `cpt-eventfrontend-flow-ai-assistant-chat-panel`

**Actor**: Signed-in User

**Success Scenarios**:
- User opens the floating chat panel, loads conversation history, sends messages, views rich cards, or resets the conversation.

**Error Scenarios**:
- Network or upstream errors display a retry banner with one-click retry capability.

**Steps**:
1. [x] - `p1` - Define chat thread types and account-scoped storage key helpers - `inst-chat-panel-storage-helpers`
2. [x] - `p1` - Normalize stored and server conversation history into UI thread messages - `inst-chat-panel-history-normalize`
3. [x] - `p1` - Define suggested starter prompts and public/admin route visibility guards - `inst-chat-panel-route-guards`
4. [x] - `p1` - Initialize widget state, refs, and auth token change listeners - `inst-chat-panel-state-init`
5. [x] - `p1` - Synchronize active account changes, session storage cache, and server history fetch - `inst-chat-panel-account-sync`
6. [x] - `p1` - Auto-scroll message thread, resize composer textarea, and enforce visibility gate - `inst-chat-panel-ui-effects`
7. [x] - `p1` - Handle chat drawer open, close, minimize, and new conversation reset - `inst-chat-panel-window-controls`
8. [x] - `p1` - Validate and prepare user message turn and conversation history payload - `inst-chat-panel-prepare-turn`
9. [x] - `p1` - Send chat turn to assistant API, extract cards, broadcast draft updates, and handle retry errors - `inst-chat-panel-send-turn`
10. [x] - `p1` - Render floating action button and minimized status pill - `inst-chat-panel-render-fab`
11. [x] - `p1` - Render chat drawer header controls and retryable error banner - `inst-chat-panel-render-header`
12. [x] - `p1` - Render message thread, welcome orientation, markdown replies, and rich event/draft cards - `inst-chat-panel-render-thread`
13. [x] - `p1` - Render quick tools bar, auto-resizing text input composer, and character counter - `inst-chat-panel-render-composer`

### Interactive Event Search & Spotlight Cards

- [x] `p1` - **ID**: `cpt-eventfrontend-flow-ai-assistant-event-cards`

**Actor**: Signed-in User

**Success Scenarios**:
- User inspects compact event search cards or expanded event spotlight detail cards and navigates to the event details page.

**Error Scenarios**:
- Missing optional metadata gracefully falls back to default labels.

**Steps**:
1. [x] - `p1` - Format event date/time ranges and handle card selection navigation in `AssistantEventCard` - `inst-event-card-handlers`
2. [x] - `p1` - Render compact event search card badges, metadata, and open action button in `AssistantEventCard` - `inst-event-card-render`
3. [x] - `p1` - Format spotlight event date/time ranges and handle event page navigation in `AssistantEventDetailCard` - `inst-event-detail-handlers`
4. [x] - `p1` - Render spotlight header, organizer profile, description, metadata grid, and CTA in `AssistantEventDetailCard` - `inst-event-detail-render`

### Draft Preview, Direct Publish & Creator Form Sync

- [x] `p1` - **ID**: `cpt-eventfrontend-flow-ai-assistant-draft-sync`

**Actor**: Signed-in User

**Success Scenarios**:
- User reviews an AI-generated event draft card, copies summary, publishes directly, or synchronizes the draft into `CreateEventPage`.

**Error Scenarios**:
- Validation issues or publish errors are surfaced inline on the draft card and form.

**Steps**:
1. [x] - `p1` - Initialize draft card state and format draft date/time range in `AssistantDraftCard` - `inst-draft-card-init`
2. [x] - `p1` - Handle creator form prefill navigation, direct event publishing, and clipboard copy in `AssistantDraftCard` - `inst-draft-card-handlers`
3. [x] - `p1` - Render draft preview banner, category/price badges, title, description, and metadata grid in `AssistantDraftCard` - `inst-draft-card-render-body`
4. [x] - `p1` - Render validation issues, publish error/success banners, and publish/edit action buttons in `AssistantDraftCard` - `inst-draft-card-render-footer`
5. [x] - `p1` - Render form section shell, date preview helper, and API response payload extractors in `CreateEventPage` - `inst-create-event-helpers`
6. [x] - `p1` - Initialize Create Event form state and synchronize AI assistant draft fields, coordinates, and live draft update events - `inst-create-event-draft-sync`
7. [x] - `p1` - Handle form field updates, location autocomplete, reverse geocoding, and input validation in `CreateEventPage` - `inst-create-event-validation`
8. [x] - `p1` - Resolve API token and submit single or recurring event occurrences with banner upload and cache invalidation - `inst-create-event-submit`
9. [x] - `p1` - Render Create Event page header, banner field, event details, and date/time/recurrence sections - `inst-create-event-render-main`
10. [x] - `p1` - Render location picker map, capacity/cost controls, form submission footer, and bottom navigation - `inst-create-event-render-location-cost`

## 3. Processes / Business Logic (CDSL)

### Assistant API Client & Structured Card Extraction

- [x] `p1` - **ID**: `cpt-eventfrontend-algo-ai-assistant-api-client`

**Input**: Conversation message arrays, tool queries, draft payloads, and raw assistant markdown replies.

**Output**: Typed assistant responses, extracted structured card payloads, and normalized `AssistantApiError` instances.

**Steps**:
1. [x] - `p1` - Define assistant TypeScript interfaces, response contracts, and `AssistantApiError` class - `inst-api-contracts`
2. [x] - `p1` - Extract structured event lists, event detail objects, and draft cards from JSON responses and embedded markdown code blocks in `extractCardsFromReply` - `inst-extract-cards`
3. [x] - `p1` - Construct Bearer authorization headers and normalize HTTP 401, 422, 502, and 503 error responses in `handleAssistantError` - `inst-api-error-handling`
4. [x] - `p1` - Execute multi-turn chat, conversation history retrieval, and new conversation initialization requests - `inst-api-chat-history`
5. [x] - `p1` - Execute assistant event search tool with automatic `/api/events/` REST query fallback - `inst-api-search-events`
6. [x] - `p1` - Execute assistant event details and draft event tools with `/api/events/:id` fallback - `inst-api-details-and-draft`
7. [x] - `p1` - Publish drafted event directly to `/api/v1/events/` with `/api/events/` fallback, local storage sync, and query cache invalidation - `inst-api-publish-draft`

### XSS-Safe Markdown Parsing & Rendering

- [x] `p1` - **ID**: `cpt-eventfrontend-algo-ai-assistant-markdown`

**Input**: Raw assistant markdown content string.

**Output**: Sanitized React element hierarchy for blocks, inline formatting, links, and copyable code blocks.

**Steps**:
1. [x] - `p1` - Render top-level `AssistantMarkdown` component and define block token union types - `inst-markdown-entry`
2. [x] - `p1` - Parse raw markdown lines into fenced code blocks, headings, blockquotes, lists, and paragraphs - `inst-markdown-parse-blocks`
3. [x] - `p1` - Render parsed block nodes into semantic React elements - `inst-markdown-render-blocks`
4. [x] - `p1` - Tokenize and render inline links, code spans, bold/italic emphasis, and copyable `CodeBlock` widgets - `inst-markdown-render-inline`

## 4. States (CDSL)

### Assistant Widget Interaction State Machine

- [x] `p1` - **ID**: `cpt-eventfrontend-state-ai-assistant-widget`

**States**: Closed, Open, Minimized, Loading, Error

**Initial State**: Closed

**Transitions**:
1. [x] - `p1` - **FROM** Closed **TO** Open **WHEN** authenticated user clicks the AI Assistant floating action button - `inst-state-open`
2. [x] - `p1` - **FROM** Open **TO** Minimized **WHEN** user toggles the minimize button in the chat header - `inst-state-minimize`

## 5. Definitions of Done

### AI Assistant Frontend Traceability & Implementation

- [x] `p1` - **ID**: `cpt-eventfrontend-dod-ai-assistant-implementation`

The system **MUST** provide full code traceability across the floating chat widget, markdown renderer, event search/detail cards, draft preview card, assistant API service, and Create Event draft synchronization.

**Implements**:
- `cpt-eventfrontend-flow-ai-assistant-chat-panel`
- `cpt-eventfrontend-flow-ai-assistant-event-cards`
- `cpt-eventfrontend-flow-ai-assistant-draft-sync`
- `cpt-eventfrontend-algo-ai-assistant-api-client`
- `cpt-eventfrontend-algo-ai-assistant-markdown`
- `cpt-eventfrontend-state-ai-assistant-widget`

**Constraints**: `cpt-eventfrontend-constraint-auth-scope`

**Touches**:
- API: `POST /api/assistant/chat`, `GET /api/assistant/messages`, `POST /api/assistant/conversations`
- Entities: `ChatThreadMessage`, `AssistantEventItem`, `AssistantDraftEvent`

## 6. Acceptance Criteria

- [x] All frontend AI Assistant components and API services are annotated with valid `@cpt-*` scope and block markers
- [x] `cfs validate` passes with 0 errors
- [x] `cfs spec-coverage` reports 100% coverage across all frontend AI files with all thresholds met
