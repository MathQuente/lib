import { FastifyReply, FastifyRequest } from 'fastify'
import { CompletionSuggestionService } from '../services/completion-suggestion.service'
import * as SuggestionSchema from '../schemas/completion-suggestion.schema'

export class CompletionSuggestionController {
  constructor(private suggestionService: CompletionSuggestionService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { platform } = SuggestionSchema.SuggestionListQuerySchema.parse(
      request.query
    )
    const result = await this.suggestionService.list(
      request.user.userId,
      platform
    )
    return reply.status(200).send(result)
  }

  async accept(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = SuggestionSchema.SuggestionParamsSchema.parse(
      request.params
    )
    const result = await this.suggestionService.accept(
      request.user.userId,
      igdbId
    )
    return reply.status(200).send(result)
  }

  async dismiss(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = SuggestionSchema.SuggestionParamsSchema.parse(
      request.params
    )
    await this.suggestionService.dismiss(request.user.userId, igdbId)
    return reply.status(204).send()
  }

  async undo(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = SuggestionSchema.SuggestionParamsSchema.parse(
      request.params
    )
    const result = await this.suggestionService.undo(
      request.user.userId,
      igdbId
    )
    return reply.status(200).send(result)
  }
}
