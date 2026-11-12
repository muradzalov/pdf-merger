import { Button, Space, Tooltip, theme } from 'antd'

interface ColorSwatchesProps {
  /** Names the group for screen readers, e.g. "Pen color". */
  label: string
  colors: readonly { name: string; value: string }[]
  value: string
  onChange: (color: string) => void
}

/** A row of small round color buttons; the chosen one has a ring around it. */
export function ColorSwatches({ label, colors, value, onChange }: ColorSwatchesProps) {
  const { token } = theme.useToken()

  return (
    <Space size={8} role="group" aria-label={label}>
      {colors.map((color) => {
        const chosen = color.value === value
        return (
          <Tooltip key={color.value} title={color.name}>
            <Button
              shape="circle"
              size="small"
              aria-label={color.name}
              aria-pressed={chosen}
              // Keep the focus where it was, so picking a color while typing in a text box doesn't
              // end the edit.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(color.value)}
              style={{
                background: color.value,
                boxShadow: chosen ? `0 0 0 2px ${token.colorBgContainer}, 0 0 0 4px ${token.colorPrimary}` : undefined,
              }}
            />
          </Tooltip>
        )
      })}
    </Space>
  )
}
