import streamlit as st
import math
import io
import pandas as pd

def gable_roof_calculations(length, breadth, height=0, extensions=None):
    if height > 0:
        s = math.sqrt(((breadth ** 2) / 4) + (height ** 2))
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

def reset_inputs():
    for key in list(st.session_state.keys()):
        del st.session_state[key]

col_logo, col_text = st.columns([1, 5])
with col_logo:
    st.image("logo.png", width=60)  # Replace with your logo URL
with col_text:
    st.markdown("---")
    st.markdown("© Designed by David Akinbode – Data Scientist and Sport Analyst")

def main():
    st.title("Simple Roof Calculator")

    col1, col2 = st.columns([1, 2])

    with col1:
        st.subheader("Tutorial Video")
        st.video("https://youtu.be/jqmUCh_d3QM")

    with col2:
        if st.button("New Calculation"):
            reset_inputs()
            st.rerun()

        length = st.number_input("Length (m)", min_value=0.0, key="length")
        breadth = st.number_input("Breadth (m)", min_value=0.0, key="breadth")
        height = st.number_input("Height (optional, m)", min_value=0.0, key="height")

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
                l_ext = st.number_input(f"Length of Extension {i+1} (m)", key=ext_len_key)
                b_ext = st.number_input(f"Breadth of Extension {i+1} (m)", key=ext_brd_key)
                q_ext = st.number_input(f"Quantity of Extension {i+1}", min_value=1, step=1, key=ext_qty_key)

                extensions.append((l_ext, b_ext, q_ext))
        else:
            extensions = None

        if st.button("Calculate"):
            area, ridge, gutter = gable_roof_calculations(length, breadth, height, extensions)
            st.session_state.total_area = area
            st.session_state.total_ridge = ridge
            st.session_state.total_gutter = gutter

        if "total_area" in st.session_state:
            st.subheader("Results")
            st.write(f"Total Roof Area: {st.session_state.total_area} m²")
            st.write(f"Total Ridge Length: {st.session_state.total_ridge} m")
            st.write(f"Total Gutter Length: {st.session_state.total_gutter} m")

            percentage = st.slider("Increase Roof Area by (%)", 0, 100, 0, key="area_increase")
            increased_area = round(st.session_state.total_area * (1 + percentage / 100), 2)
            if percentage > 0:
                st.write(f"Adjusted Roof Area (+{percentage}%): {increased_area} m²")

            result_data = {
                "Total Area (m²)": [st.session_state.total_area],
                "Total Ridge Length (m)": [st.session_state.total_ridge],
                "Total Gutter Length (m)": [st.session_state.total_gutter]
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
    st.markdown("---")
    st.markdown("© Designed by David Akinbode – Data Scientist and Sport Analyst")
