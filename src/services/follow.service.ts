import { ClientError } from '../errors/client-error'
import { FollowRepository } from '../repositories/follow.repository'
import { UserRepository } from '../repositories/users.repository'

export class FollowService {
  constructor(
    private followRepository: FollowRepository,
    private userRepository: UserRepository
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async follow(userId: string, targetId: string) {
    if (userId === targetId) {
      throw new ClientError('Você não pode seguir a si mesmo.', 400)
    }

    await this.requireUser(userId)
    await this.requireUser(targetId)

    const alreadyFollowing = await this.followRepository.isFollowing(
      userId,
      targetId
    )
    if (alreadyFollowing) {
      throw new ClientError('Você já segue este usuário.', 409)
    }

    await this.followRepository.follow(userId, targetId)
  }

  async unfollow(userId: string, targetId: string) {
    await this.followRepository.unfollow(userId, targetId)
  }

  async isFollowing(userId: string, targetId: string) {
    if (userId === targetId) return { isFollowing: false }
    const isFollowing = await this.followRepository.isFollowing(
      userId,
      targetId
    )
    return { isFollowing }
  }

  async getFollowers(userId: string) {
    await this.requireUser(userId)
    const followers = await this.followRepository.findFollowers(userId)
    return { followers }
  }

  async getFollowing(userId: string) {
    await this.requireUser(userId)
    const following = await this.followRepository.findFollowing(userId)
    return { following }
  }
}
