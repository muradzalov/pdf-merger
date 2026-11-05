import { Button, Flex, List, Typography } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useAtomValue, useSetAtom } from 'jotai'
import { clearFilesAtom, filesAtom, moveFileAtom } from '../state/files'
import { FileListItem } from './FileListItem'

export function FileList() {
  const files = useAtomValue(filesAtom)
  const moveFile = useSetAtom(moveFileAtom)
  const clearFiles = useSetAtom(clearFilesAtom)
  // Require a small drag distance so clicks (e.g. on the delete button) aren't treated as drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      moveFile({ fromId: String(active.id), toId: String(over.id) })
    }
  }

  return (
    <div>
      <Flex justify="space-between" align="center">
        <Typography.Text strong>
          {files.length} file{files.length !== 1 ? 's' : ''} — drag to reorder
        </Typography.Text>
        <Button type="text" danger size="small" icon={<ClearOutlined />} onClick={() => clearFiles()}>
          Remove all
        </Button>
      </Flex>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <List
            bordered
            style={{ marginTop: 8 }}
            dataSource={files}
            renderItem={(queued) => <FileListItem key={queued.id} queued={queued} />}
          />
        </SortableContext>
      </DndContext>
    </div>
  )
}
