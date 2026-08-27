data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math:internal y
data modify storage math:internal w set compute default math:common/reciprocal/00
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal z set compute default math:common/rounding/quotient
data modify storage math:internal w set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal x set compute default math:common/rounding/add_half
function math:internal/floor_x
data modify storage math:internal z set compute default math:common/rounding/reduce
return 1
