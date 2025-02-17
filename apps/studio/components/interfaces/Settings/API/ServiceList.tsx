import { JwtSecretUpdateError, JwtSecretUpdateStatus } from '@supabase/shared-types/out/events'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useParams } from 'common/hooks'
import DatabaseSelector from 'components/ui/DatabaseSelector'
import Panel from 'components/ui/Panel'
import { DisplayApiSettings } from 'components/ui/ProjectSettings'
import { useJwtSecretUpdatingStatusQuery } from 'data/config/jwt-secret-updating-status-query'
import { configKeys } from 'data/config/keys'
import { useProjectApiQuery } from 'data/config/project-api-query'
import { useCustomDomainsQuery } from 'data/custom-domains/custom-domains-query'
import { useReadReplicasQuery } from 'data/read-replicas/replicas-query'
import { useFlag, useSelectedProject, useStore } from 'hooks'
import { useDatabaseSelectorStateSnapshot } from 'state/database-selector'
import { Badge, IconAlertCircle, Input } from 'ui'
import { JWT_SECRET_UPDATE_ERROR_MESSAGES } from './API.constants'
import JWTSettings from './JWTSettings'
import PostgrestConfig from './PostgrestConfig'

const ServiceList = () => {
  const { ui } = useStore()
  const client = useQueryClient()
  const project = useSelectedProject()
  const { ref: projectRef } = useParams()
  const state = useDatabaseSelectorStateSnapshot()

  const readReplicasEnabled = useFlag('readReplicas')
  const showReadReplicasUI = readReplicasEnabled && project?.is_read_replicas_enabled

  const { data: settings, isError } = useProjectApiQuery({
    projectRef,
  })
  const { data: customDomainData } = useCustomDomainsQuery({ projectRef })
  const { data: databases } = useReadReplicasQuery({ projectRef })

  const { data } = useJwtSecretUpdatingStatusQuery({ projectRef })
  const jwtSecretUpdateStatus = data?.jwtSecretUpdateStatus
  const jwtSecretUpdateError = data?.jwtSecretUpdateError

  const previousJwtSecretUpdateStatus = useRef<JwtSecretUpdateStatus>()
  const { Failed, Updated, Updating } = JwtSecretUpdateStatus
  const jwtSecretUpdateErrorMessage =
    JWT_SECRET_UPDATE_ERROR_MESSAGES[jwtSecretUpdateError as JwtSecretUpdateError]

  useEffect(() => {
    if (previousJwtSecretUpdateStatus.current === Updating) {
      switch (jwtSecretUpdateStatus) {
        case Updated:
          client.invalidateQueries(configKeys.api(projectRef))
          client.invalidateQueries(configKeys.settings(projectRef))
          client.invalidateQueries(configKeys.postgrest(projectRef))

          ui.setNotification({ category: 'success', message: 'Successfully updated JWT secret' })
          break
        case Failed:
          ui.setNotification({
            category: 'error',
            message: `JWT secret update failed: ${jwtSecretUpdateErrorMessage}`,
          })
          break
      }
    }

    previousJwtSecretUpdateStatus.current = jwtSecretUpdateStatus
  }, [jwtSecretUpdateStatus])

  // Get the API service
  const isCustomDomainActive = customDomainData?.customDomain?.status === 'active'
  const apiService = settings?.autoApiService
  const apiUrl = `${apiService?.protocol ?? 'https'}://${apiService?.endpoint ?? '-'}`

  const selectedDatabase = databases?.find((db) => db.identifier === state.selectedDatabaseId)

  const primaryEndpoint = isCustomDomainActive
    ? `https://${customDomainData.customDomain.hostname}`
    : apiUrl
  const endpoint = !showReadReplicasUI
    ? primaryEndpoint
    : isCustomDomainActive && state.selectedDatabaseId === projectRef
      ? `https://${customDomainData.customDomain.hostname}`
      : selectedDatabase?.restUrl

  return (
    <div>
      <h3 className="mb-6 text-xl text-foreground">API Settings</h3>
      <section>
        <Panel
          title={
            <div className="w-full flex items-center justify-between">
              <h5 className="mb-0">Project URL</h5>
              {showReadReplicasUI && <DatabaseSelector />}
            </div>
          }
        >
          <Panel.Content>
            {isError ? (
              <div className="flex items-center justify-center py-4 space-x-2">
                <IconAlertCircle size={16} strokeWidth={1.5} />
                <p className="text-sm text-foreground-light">Failed to retrieve project URL</p>
              </div>
            ) : (
              <Input
                copy
                label={
                  isCustomDomainActive ? (
                    <div className="flex items-center space-x-2">
                      <p>URL</p>
                      <Badge>Custom domain active</Badge>
                    </div>
                  ) : (
                    'URL'
                  )
                }
                readOnly
                disabled
                className="input-mono"
                value={endpoint}
                descriptionText="A RESTful endpoint for querying and managing your database."
                layout="horizontal"
              />
            )}
          </Panel.Content>
        </Panel>
      </section>

      <section>
        <DisplayApiSettings key="DisplayAPISettings" />
      </section>

      <section>
        <JWTSettings />
      </section>

      <section>
        <PostgrestConfig />
      </section>
    </div>
  )
}

export default ServiceList
