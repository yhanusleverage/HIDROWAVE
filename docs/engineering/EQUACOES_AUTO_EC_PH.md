# Ecuaciones canónicas — Auto EC / Auto pH

Copia de producto. Firmware: [`ESP-HIDROWAVE-main/docs/engineering/EQUACOES_AUTO_EC_PH.md`](../../../ESP-HIDROWAVE-main/docs/engineering/EQUACOES_AUTO_EC_PH.md).

## Déficit EC

`u = (V / k) · e · Kp · A` ml  
`ml_i = u · (r_i / R)`  
`t_i = ml_i / q_i`  (`q_i` = `nutrients[].flowRate`)

## Exceso EC

`V_dreno = V · (1 − SP / EC)`

## pH (firmware)

Puerta: `|pH − SP| ≤ ph_tolerance` → idle. Sin max_*.

```
H     = 10^(−pH)
ErroH = H_medido − H_SP
u     = A · |ErroH| / K     [ml]
t     = u / q               (q = flow_rate_ph_up o flow_rate_ph_down)
```

ErroH > 0 → base. ErroH < 0 → ácido.
