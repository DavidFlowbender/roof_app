import streamlit as st
import math
import io
import pandas as pd

# Roof Calculation Function
def gable_roof_calculations(length, breadth, height=0, extensions=None):
    if height > 0:
        s = math.sqrt((breadth / 2) ** 2 + height ** 2) / 2
    else:
        s = breadth / math.sqrt(2)

    top_ridge = length - breadth
    ridge = math.sqrt((breadth / 2) ** 2 + s ** 2)

    if extensions:
        total_area = s * (top_ridge + length) + (breadth * s)
        total_ridge = 4 * ridge + top_ridge
        total_gutter = 0
        RnBn = 0

        for ext in extensions:
            l_ext, b_ext, q_ext = ext
            r_ext = math.sqrt(l_ext ** 2 + b_ext ** 2) / 2
            RnBn += 2 * (r_ext * b_ext)
            total_ridge += (q_ext * r_ext) + b_ext
            total_gutter += q_ext * r_ext

        total_area += RnBn
    else:
        total_area = s * (top_ridge + length) + (breadth * s)
        total_ridge = 4 * ridge + top_ridge
        total_gutter = "No gutter expected"

    total_area = round(total_area, 2)
    total_ridge = round(total_ridge, 2)
    if isinstance(total_gutter, float):
        total_gutter = round(total_gutter, 2)

    return total_area, total_ridge, total_gutter

# Reset all input values
def reset_inputs():
    for key in list(st.session_state.keys()):
        del st.session_state[key]

# Main Streamlit UI
def main():
    st.title("Gable Roof Calculator")

    if st.button("New Calculation"):
        reset_inputs()
        st.rerun()

    if "unit" not in st.session_state:
        st.session_state.unit = "metric (meters)"
    if "length" not in st.session_state:
        st.session_state.length = 0.0
    if "breadth" not in st.session_state:
        st.session_state.breadth = 0.0
    if "height" not in st.session_state:
        st.session_state.height = 0.0
    if "num_extensions" not in st.session_state:
        st.session_state.num_extensions = 1

    unit = st.selectbox("Select Unit", ["metric (meters)", "imperial (feet)"], index=0, key="unit")

    if "imperial" in unit:
        length = st.number_input("Length (ft)", min_value=0.0, key="length")
        breadth = st.number_input("Breadth (ft)", min_value=0.0, key="breadth")
        height = st.number_input("Height (optional, ft)", min_value=0.0, key="height")
        conversion_factor = 0.3048
    else:
        length = st.number_input("Length (m)", min_value=0.0, key="length")
        breadth = st.number_input("Breadth (m)", min_value=0.0, key="breadth")
        height = st.number_input("Height (optional, m)", min_value=0.0, key="height")
        conversion_factor = 1.0

    use_extensions = st.radio("Add Extensions?", ["no", "yes"])
    extensions = []

    if use_extensions == "yes":
        st.number_input("Number of Extensions", min_value=1, step=1, key="num_extensions")

        for i in range(int(st.session_state.num_extensions)):
            ext_len_key = f"l{i}"
            ext_brd_key = f"b{i}"
            ext_qty_key = f"q{i}"

            if ext_len_key not in st.session_state:
                st.session_state[ext_len_key] = 0.0
            if ext_brd_key not in st.session_state:
                st.session_state[ext_brd_key] = 0.0
            if ext_qty_key not in st.session_state:
                st.session_state[ext_qty_key] = 1

            st.subheader(f"Extension {i+1}")
            if "imperial" in unit:
                l_ext = st.number_input(f"Length of Extension {i+1} (ft)", key=ext_len_key)
                b_ext = st.number_input(f"Breadth of Extension {i+1} (ft)", key=ext_brd_key)
            else:
                l_ext = st.number_input(f"Length of Extension {i+1} (m)", key=ext_len_key)
                b_ext = st.number_input(f"Breadth of Extension {i+1} (m)", key=ext_brd_key)
            q_ext = st.number_input(f"Quantity of Extension {i+1}", min_value=1, step=1, key=ext_qty_key)

            extensions.append((l_ext * conversion_factor, b_ext * conversion_factor, q_ext))
    else:
        extensions = None

    if st.button("Calculate"):
        total_area, total_ridge, total_gutter = gable_roof_calculations(
            length * conversion_factor, breadth * conversion_factor, height * conversion_factor, extensions
        )

        if "imperial" in unit:
            total_area = round(total_area / 0.092903, 2)
            total_ridge = round(total_ridge / 0.3048, 2)
            if isinstance(total_gutter, float):
                total_gutter = round(total_gutter / 0.3048, 2)

        st.subheader("Results")
        if "metric" in unit:
            st.write(f"Total Roof Area: {total_area} m²")
            st.write(f"Total Ridge Length: {total_ridge} m")
            st.write(f"Total Gutter Length: {total_gutter} m")
        else:
            st.write(f"Total Roof Area: {total_area} ft²")
            st.write(f"Total Ridge Length: {total_ridge} ft")
            st.write(f"Total Gutter Length: {total_gutter} ft")

        result_data = {
            "Total Area": [total_area],
            "Total Ridge Length": [total_ridge],
            "Total Gutter Length": [total_gutter],
            "Unit": ["ft" if "imperial" in unit else "m"]
        }
        df_result = pd.DataFrame(result_data)

        csv_buffer = io.StringIO()
        df_result.to_csv(csv_buffer, index=False)
        csv_data = csv_buffer.getvalue()

        st.download_button(
            label="Download Results as CSV",
            data=csv_data,
            file_name="roof_results.csv",
            mime="text/csv"
        )

if __name__ == "__main__":
    main()
