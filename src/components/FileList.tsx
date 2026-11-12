import { Button, Flex, List, Space, Typography } from 'antd'
import { ClearOutlined, SortAscendingOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useAtomValue, useSetAtom } from 'jotai'
import { compareFileNames } from '../lib/fileOrder'
import { clearFilesAtom, filesAtom, moveFileAtom, sortFilesAtom } from '../state/files'
import { FileListItem } from './FileListItem'

export function FileList() {
  const files = useAtomValue(filesAtom)
  const moveFile = useSetAtom(moveFileAtom)
  const sortFiles = useSetAtom(sortFilesAtom)
  const clearFiles = useSetAtom(clearFilesAtom)
  const isSorted = files.every((f, i) => i === 0 || compareFileNames(files[i - 1].file, f.file) <= 0)
  const sensors = useSensors(
    // Require a small drag distance so clicks (e.g. on the delete button) aren't treated as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Focus a drag handle, press Space, move with the arrow keys, press Space again to drop.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
        <Space size={0}>
          {/* Greyed out when the list is already in A–Z order */}
          <Button type="text" size="small" icon={<SortAscendingOutlined />} disabled={isSorted} onClick={() => sortFiles()}>
            Sort A–Z
          </Button>
          <Button type="text" danger size="small" icon={<ClearOutlined />} onClick={() => clearFiles()}>
            Remove all
          </Button>
        </Space>
      </Flex>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <List
            bordered
            rowKey="id"
            // Long lists scroll inside the box so the Merge button stays in view.
            // Dragging near the top/bottom edge auto-scrolls (dnd-kit does this by default).
            style={{ marginTop: 8, maxHeight: '60vh', overflowY: 'auto' }}
            dataSource={files}
            renderItem={(queued) => <FileListItem queued={queued} />}
          />
        </SortableContext>
      </DndContext>
    </div>
  )
}
